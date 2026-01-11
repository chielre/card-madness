import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null
let connectPromise: Promise<Socket> | null = null

export function getSocket(): Socket | null {
    return socket
}

export function connectSocket(): Promise<Socket> {
    if (connectPromise) return connectPromise
    if (socket && socket.connected) return Promise.resolve(socket)

    connectPromise = new Promise((resolve, reject) => {
        const url = import.meta.env.VITE_WS_SERVER_URL ?? 'http://localhost:3001'

        const s = io(url, {
            transports: ['websocket'],
            reconnectionAttempts: 3,
            timeout: 5000,
        })

        const onConnect = () => {
            socket = s
            cleanup()
            resolve(s)
        }

        const onError = (err: Error) => {
            cleanup()
            reject(err)
        }

        const onConnectError = (err: Error) => {
            cleanup()
            reject(err)
        }

        const cleanup = () => {
            s.off('connect', onConnect)
            s.off('connect_error', onConnectError)
            s.off('error', onError)
            connectPromise = null
        }

        s.on('connect', onConnect)
        s.on('connect_error', onConnectError)
        s.on('error', onError)
    })

    return connectPromise
}
