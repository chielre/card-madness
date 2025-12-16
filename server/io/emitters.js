export const emitPlayersUpdated = ({ io, roomId, game }) => {
  io.to(roomId).emit('room:players-changed', {
    players: game.players,
  })
}