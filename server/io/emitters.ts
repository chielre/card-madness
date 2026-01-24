export const emitPlayersUpdated = ({ io, lobbyId, game }) => {
  io.to(lobbyId).emit('room:players-changed', {
    players: game.players,
  })
}

export const emitPlayerCardsUpdated = (io, game) => {
  if (!game?.players?.length) return
  game.players.forEach((player) => {
    io.to(player.id).emit('room:player-cards-updated', { cards: player.white_cards ?? [] })
  })
}
