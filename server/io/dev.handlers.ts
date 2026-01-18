import { emitPlayersUpdated } from './emitters.js'
import { ensureBotLoop, spawnBotPlayer } from '../services/botService.js'

const isDevEnv = () => process.env.STAGE === 'development'

export const registerDevHandlers = ({ io, socket, games }) => {
    socket.on('dev:spawn-bot', async ({ lobbyId, name }, cb) => {
        if (!isDevEnv()) return cb?.({ error: 'not_allowed' })
        if (!lobbyId) return cb?.({ error: 'invalid_payload' })

        const res = await spawnBotPlayer({ games, lobbyId, name })
        if (res?.error) return cb?.({ error: res.error })
        if (res?.game) {
            emitPlayersUpdated({ io, lobbyId, game: res.game })
        }
        ensureBotLoop({ io, games, lobbyId })
        cb?.({ ok: true, player: res.player })
    })
}
