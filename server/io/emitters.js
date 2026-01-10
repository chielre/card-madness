export const emitPlayersUpdated = ({ io, lobbyId, game }) => {
  io.to(lobbyId).emit('room:players-changed', {
    players: game.players,
  })
}