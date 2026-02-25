// debug/routes.ts
import type { Express } from 'express'
import { games, socketRooms, phaseTimers, roundTimers, selectionLockTimers } from '../state/store.js'
import { mapToObj, mapSetToObj, mapMapToObj } from './serialize.js'

export function registerDebugRoutes(app: Express) {
    // Zet dit achter auth of IP allowlist!
    app.get('/__debug/state', (_req, res) => {
        res.json({
            games: mapToObj(games),
            socketRooms: mapSetToObj(socketRooms),
            phaseTimers: mapToObj(phaseTimers),
            roundTimers: mapToObj(roundTimers),
            selectionLockTimers: mapMapToObj(selectionLockTimers),
            meta: {
                gamesCount: games.size,
                roomsCount: socketRooms.size,
            },
            now: Date.now(),
        })
    })

    app.listen(3003, () => {
        console.log('Server is running on http://localhost:3000')
    })
}
