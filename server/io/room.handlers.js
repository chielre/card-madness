import { createGame, joinGame, leaveGame, givePlayerHand } from '../services/gameService.js'
import { transitionPhase } from '../services/phaseService.js'
import { startCzarPhase, startRoundFlow } from '../services/phaseFlowService.js'
import { trackJoin, trackLeave } from '../services/socketRoomService.js'
import { clearPhaseTimer, schedulePhaseTimer } from '../utils/phaseTimers.js'
import { clearRoundTimer } from '../utils/roundTimers.js'
import { PHASE_DEFAULT_DURATIONS } from '../config/phaseDurations.js'
import { phaseTimers, roundTimers, selectionLockTimers } from '../state/store.js'
import { emitPlayersUpdated } from './emitters.js'

export const registerRoomHandlers = ({ io, socket, games, socketRooms }) => {
    socket.on('room:create', ({ hostName, language }, cb) => {
        const trimmedName = (hostName ?? '').toString().trim()
        if (trimmedName.length > 25) return cb?.({ error: 'name_too_long' })
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

    socket.on('room:join', async ({ lobbyId, name, language }, cb) => {
        const trimmedName = (name ?? '').toString().trim()
        if (trimmedName.length > 25) return cb?.({ error: 'name_too_long' })
        const game = joinGame({
            games,
            lobbyId,
            player: { id: socket.id, name, ready: false, language },
        })
        if (!game) return cb?.({ error: 'not_found' })

        if (!['lobby', 'starting'].includes(game.phase)) {
            const dealRes = await givePlayerHand({ games, lobbyId, playerId: socket.id })
            if (!dealRes?.error && dealRes?.player) {
                socket.emit("room:player-cards-updated", { cards: dealRes.player.white_cards ?? [] })
            }
        }

        socket.join(lobbyId)
        trackJoin(socketRooms, socket.id, lobbyId)

        socket.to(lobbyId).emit('room:player-joined', { id: socket.id, name, ready: false, language })
        const currentRoundNumber = Number(game.currentRound) || 0
        const currentRound = currentRoundNumber ? game.rounds?.[currentRoundNumber] ?? null : null
        const phaseTimer = phaseTimers.get(lobbyId)
        const roundTimer = roundTimers.get(lobbyId)
        cb?.({
            lobbyId: lobbyId,
            phase: game.phase,
            host: game.host,
            players: game.players,
            selectedPacks: game.selectedPacks ?? [],
            currentRound,
            currentRoundNumber,
            phaseTimerPhase: phaseTimer?.phase ?? '',
            phaseTimerDurationMs: phaseTimer?.durationMs ?? 0,
            phaseTimerExpiresAt: phaseTimer?.expiresAt ?? 0,
            roundTimerDurationMs: roundTimer?.durationMs ?? 0,
            roundTimerExpiresAt: roundTimer?.expiresAt ?? 0,
        })

        const lockMap = selectionLockTimers.get(lobbyId)
        if (lockMap && currentRound?.playerSelectedCards?.length) {
            lockMap.forEach((info, playerId) => {
                const hasEntry = currentRound.playerSelectedCards?.some((entry) => entry.playerId === playerId)
                if (!hasEntry) return
                socket.emit('board:player-card-selected', {
                    playerId,
                    selectionLockDurationMs: info?.durationMs ?? 10000,
                    selectionLockExpiresAt: info?.expiresAt ?? (Date.now() + 10000),
                    sync: true,
                })
            })
        }
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

    socket.on('room:kick', ({ lobbyId, playerId }, cb) => {
        const game = games.get(lobbyId)
        if (!game) return cb?.({ error: 'not_found' })
        if (game.host !== socket.id) return cb?.({ error: 'not_host' })
        if (!playerId || playerId === game.host) return cb?.({ error: 'invalid_player' })

        const res = leaveGame({ games, lobbyId, socketId: playerId })
        if (!res) return cb?.({ error: 'not_found' })

        const playerSocket = io.sockets.sockets.get(playerId)
        if (playerSocket) {
            playerSocket.leave(lobbyId)
            trackLeave(socketRooms, playerId, lobbyId)
            playerSocket.emit('room:kicked', { lobbyId })
        }

        socket.to(lobbyId).emit('room:player-left', { id: playerId, players: res.game?.players ?? [] })
        emitPlayersUpdated({ io, lobbyId, game: res.game })

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
        const currentRoundNumber = Number(game.currentRound) || 0
        const currentRound = currentRoundNumber ? game.rounds?.[currentRoundNumber] ?? null : null
        const phaseTimer = phaseTimers.get(lobbyId)
        const roundTimer = roundTimers.get(lobbyId)
        cb?.({
            lobbyId: lobbyId,
            phase: game.phase,
            host: game.host,
            players: game.players,
            selectedPacks: game.selectedPacks ?? [],
            currentRound,
            currentRoundNumber,
            phaseTimerPhase: phaseTimer?.phase ?? '',
            phaseTimerDurationMs: phaseTimer?.durationMs ?? 0,
            phaseTimerExpiresAt: phaseTimer?.expiresAt ?? 0,
            roundTimerDurationMs: roundTimer?.durationMs ?? 0,
            roundTimerExpiresAt: roundTimer?.expiresAt ?? 0,
        })
    })

    socket.on('room:phase-set', ({ lobbyId, phase, durationMs, nextPhase }, cb) => {
        const game = games.get(lobbyId)
        if (!game) return cb?.({ error: 'not_found' })

        if (game.host !== socket.id) return cb?.({ error: 'not_host' })

        clearPhaseTimer(lobbyId)
        clearRoundTimer(lobbyId)

        if (phase === 'starting' && (game.players?.length ?? 0) < 2) {
            return cb?.({ error: 'not_enough_players' })
        }

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
