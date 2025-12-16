import { createGame, joinGame, leaveGame, setPhase } from '../services/gameService.js'
import { trackJoin, trackLeave } from '../services/socketRoomService.js'
import { clearPhaseTimer, schedulePhaseTimer } from '../utils/phaseTimers.js'
import { PHASE_DEFAULT_DURATIONS } from '../config/phaseDurations.js'

export const registerRoomHandlers = ({ io, socket, games, socketRooms }) => {
    socket.on('room:create', ({ name }, cb) => {
        const game = createGame({ games, hostId: socket.id, name })

        socket.join(game.lobbyId)
        trackJoin(socketRooms, socket.id, game.lobbyId)

        cb?.({ lobbyId: game.lobbyId, phase: game.phase, host: game.host, selectedPacks: game.selectedPacks })
    })

    socket.on('room:join', ({ roomId, name }, cb) => {
        const game = joinGame({
            games,
            roomId,
            player: { id: socket.id, name, ready: false },
        })
        if (!game) return cb?.({ error: 'not_found' })

        socket.join(roomId)
        trackJoin(socketRooms, socket.id, roomId)

        socket.to(roomId).emit('room:player-joined', { id: socket.id, name, ready: false })
        cb?.({ lobbyId: roomId, phase: game.phase, host: game.host, players: game.players, selectedPacks: game.selectedPacks ?? [] })
    })

    socket.on('room:leave', ({ roomId }, cb) => {
        const res = leaveGame({ games, roomId, socketId: socket.id })
        if (!res) return cb?.({ error: 'not_found' })

        socket.leave(roomId)
        trackLeave(socketRooms, socket.id, roomId)

        socket.to(roomId).emit('room:player-left', { id: socket.id, players: res.game?.players ?? [] })
        if (res.hostChangedTo) io.to(roomId).emit('room:host-changed', { hostId: res.hostChangedTo })

        cb?.({ ok: true })
    })

    socket.on('room:state', ({ roomId }, cb) => {
        const game = games.get(roomId)
        if (!game) return cb?.({ error: 'not_found' })
        cb?.({ lobbyId: roomId, phase: game.phase, host: game.host, players: game.players, selectedPacks: game.selectedPacks ?? [] })
    })

    socket.on('room:phase-set', ({ roomId, phase, durationMs, nextPhase }, cb) => {
        const game = games.get(roomId)
        if (!game) return cb?.({ error: 'not_found' })
        if (game.host !== socket.id) return cb?.({ error: 'not_host' })

        const res = setPhase({ games, roomId, to: phase })
        if (res.error) return cb?.(res)

        clearPhaseTimer(roomId)

        // inform everyone of the new phase
        io.to(roomId).emit('room:phase-changed', { phase: res.game.phase })

        // schedule a timeout notification using provided duration or defaults
        schedulePhaseTimer({
            io,
            roomId,
            phase: res.game.phase,
            durationMs,
            defaultDurations: PHASE_DEFAULT_DURATIONS,
            onTimeout: () => {
                if (!nextPhase) return
                const phaseRes = setPhase({ games, roomId, to: nextPhase })
                if (!phaseRes.error) {
                    io.to(roomId).emit('room:phase-changed', { phase: phaseRes.game.phase })
                }
            },
        })

        cb?.({ lobbyId: roomId, phase: game.phase, host: game.host, players: game.players, selectedPacks: game.selectedPacks ?? [] })

    })


}
