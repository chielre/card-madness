import { setReady } from '../services/gameService.js'
import { emitPlayersUpdated } from './emitters.js'

export const registerPlayerHandlers = ({ io, socket, games }) => {
    socket.on('player:ready', ({ roomId, ready }, cb) => {
        const res = setReady({ games, roomId, socketId: socket.id, ready })
        if (res.error) return cb?.({ error: res.error })


        emitPlayersUpdated({ io, roomId, game: res.game })

        cb?.({ ok: true })
    })
}
