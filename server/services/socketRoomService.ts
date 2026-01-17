export const trackJoin = (socketRooms, socketId, lobbyId) => {
    const rooms = socketRooms.get(socketId) ?? new Set()
    rooms.add(lobbyId)
    socketRooms.set(socketId, rooms)
}

export const trackLeave = (socketRooms, socketId, lobbyId) => {
    const rooms = socketRooms.get(socketId)
    if (!rooms) return
    rooms.delete(lobbyId)
    if (rooms.size === 0) socketRooms.delete(socketId)
}
