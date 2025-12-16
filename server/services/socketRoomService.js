export const trackJoin = (socketRooms, socketId, roomId) => {
    const rooms = socketRooms.get(socketId) ?? new Set()
    rooms.add(roomId)
    socketRooms.set(socketId, rooms)
}

export const trackLeave = (socketRooms, socketId, roomId) => {
    const rooms = socketRooms.get(socketId)
    if (!rooms) return
    rooms.delete(roomId)
    if (rooms.size === 0) socketRooms.delete(socketId)
}
