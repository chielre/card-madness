import { createGame, joinGame, leaveGame } from '../services/gameService.js'
import { transitionPhase } from '../services/phaseService.js'
import { startCzarPhase, startRoundFlow } from '../services/phaseFlowService.js'
import { trackJoin, trackLeave } from '../services/socketRoomService.js'
import { clearPhaseTimer, schedulePhaseTimer } from '../utils/phaseTimers.js'
import { clearRoundTimer } from '../utils/roundTimers.js'
import { PHASE_DEFAULT_DURATIONS } from '../config/phaseDurations.js'

export const registerRoomHandlers = ({ io, socket, games, socketRooms }) => {
    socket.on('room:create', ({ hostName, language }, cb) => {
        const game = createGame({
            games,
            hostId: socket.id,
            hostName: hostName,
            language: language
        })

        socket.join(game.lobbyId)
        trackJoin(socketRooms, socket.id, game.lobbyId)

        cb?.({
            lobbyId: game.lobbyId,
            phase: game.phase,
            host: game.host,
            selectedPacks: game.selectedPacks
        })
    })

    socket.on('room:join', ({ lobbyId, name, language }, cb) => {
        const game = joinGame({
            games,
            lobbyId,
            player: { id: socket.id, name, ready: false, language },
        })
        if (!game) return cb?.({ error: 'not_found' })

        socket.join(lobbyId)
        trackJoin(socketRooms, socket.id, lobbyId)

        socket.to(lobbyId).emit('room:player-joined', { id: socket.id, name, ready: false, language })
        cb?.({ lobbyId: lobbyId, phase: game.phase, host: game.host, players: game.players, selectedPacks: game.selectedPacks ?? [] })
    })

    socket.on('room:leave', ({ lobbyId }, cb) => {
        const res = leaveGame({ games, lobbyId, socketId: socket.id })
        if (!res) return cb?.({ error: 'not_found' })

        socket.leave(lobbyId)
        trackLeave(socketRooms, socket.id, lobbyId)

        socket.to(lobbyId).emit('room:player-left', { id: socket.id, players: res.game?.players ?? [] })
        if (res.hostChangedTo) io.to(lobbyId).emit('room:host-changed', { hostId: res.hostChangedTo })

        if (res.deleted) {
            clearPhaseTimer(lobbyId)
            clearRoundTimer(lobbyId)
        }

        cb?.({ ok: true })
    })

    socket.on('room:state', ({ lobbyId }, cb) => {
        const game = games.get(lobbyId)
        if (!game) return cb?.({ error: 'not_found' })
        cb?.({ lobbyId: lobbyId, phase: game.phase, host: game.host, players: game.players, selectedPacks: game.selectedPacks ?? [] })
    })

    socket.on('room:phase-set', ({ lobbyId, phase, durationMs, nextPhase }, cb) => {
        const game = games.get(lobbyId)
        if (!game) return cb?.({ error: 'not_found' })

        if (game.host !== socket.id) return cb?.({ error: 'not_host' })

        clearPhaseTimer(lobbyId)
        clearRoundTimer(lobbyId)

        if (phase === 'board') {
            const currentRound = Number(game.currentRound) || 0
            const nextRound = game.phase === 'czar-result' ? currentRound + 1 : Math.max(1, currentRound || 1)
            const res = startRoundFlow({ io, games, lobbyId, round: nextRound, durationMs })
            if (res?.error) return cb?.(res)
            const updated = games.get(lobbyId)
            return cb?.({ lobbyId: lobbyId, phase: updated?.phase ?? game.phase, host: updated?.host ?? game.host, players: updated?.players ?? game.players, selectedPacks: updated?.selectedPacks ?? game.selectedPacks ?? [] })
        }

        if (phase === 'czar') {
            startCzarPhase({ io, games, lobbyId, round: game.currentRound, durationMs })
            const updated = games.get(lobbyId)
            return cb?.({ lobbyId: lobbyId, phase: updated?.phase ?? game.phase, host: updated?.host ?? game.host, players: updated?.players ?? game.players, selectedPacks: updated?.selectedPacks ?? game.selectedPacks ?? [] })
        }

        const res = transitionPhase({ games, io, lobbyId, to: phase })
        if (res.error) return cb?.(res)

        const phaseTimer = schedulePhaseTimer({
            io,
            lobbyId,
            phase: res.game.phase,
            durationMs,
            defaultDurations: PHASE_DEFAULT_DURATIONS,
            onTimeout: () => {
                if (!nextPhase) return
                transitionPhase({ games, io, lobbyId, to: nextPhase })
            },
        })
        if (phaseTimer) {
            io.to(lobbyId).emit('room:phase-timer', { phase: res.game.phase, ...phaseTimer })
        }

        cb?.({ lobbyId: lobbyId, phase: game.phase, host: game.host, players: game.players, selectedPacks: game.selectedPacks ?? [] })

    })


}
