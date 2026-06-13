import { defineStore } from 'pinia'
import { connectSocket, getSocket } from '@/ws/socket'

let connecting: Promise<void> | null = null

export const useConnectionStore = defineStore('connection', {
    state: () => ({
        isConnecting: false,
        isConnected: false,
        socketId: null as string | null,
        error: null as string | null,
    }),

    actions: {
        async connect() {
            if (this.isConnected && getSocket()?.connected) return
            if (connecting) return connecting

            this.isConnecting = true
            this.error = null

            connecting = (async () => {
                try {
                    const socket = await connectSocket()

                    this.isConnected = true
                    this.socketId = socket.id ?? null
                    this.error = null

                    socket.on('disconnect', () => {
                        this.isConnected = false
                        this.socketId = null
                    })

                    socket.on('connect', () => {
                        this.isConnected = true
                        this.socketId = socket.id ?? null
                        this.error = null
                    })

                    socket.on('connect_error', (err: Error) => {
                        this.error = err.message
                        this.isConnected = false
                        this.socketId = null
                    })
                } catch (e: unknown) {
                    this.error =
                        e instanceof Error ? e.message : 'Kon geen verbinding maken met de server'
                    this.isConnected = false
                    this.socketId = null
                } finally {
                    this.isConnecting = false
                    connecting = null
                }
            })()

            return connecting
        },

        async ensureSocket() {
            if (!this.isConnected) {
                await this.connect()
            }

            const socket = getSocket()
            if (!socket) throw new Error('Socket niet beschikbaar')

            this.socketId = socket.id ?? this.socketId

            return socket
        },

        async emitWithAck<T>(event: string, payload: unknown, timeoutMs = 5000): Promise<T> {
            const socket = await this.ensureSocket()
            return new Promise((resolve, reject) => {
                socket.timeout(timeoutMs).emit(event, payload, (err: Error | null, response: T) => {
                    if (err) return reject(err)
                    resolve(response)
                })
            })
        },

        getSocketSafe() {
            return getSocket()
        },
    },
})
