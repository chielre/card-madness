import logUpdate from 'log-update'
import chalk from 'chalk'

export const startConsole = ({ io, games, intervalMs = 500 }) => {
    const startedAt = Date.now()

    const fmtUptime = (ms) => {
        const s = Math.floor(ms / 1000)
        const hh = String(Math.floor(s / 3600)).padStart(2, "0")
        const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
        const ss = String(s % 60).padStart(2, "0")
        return `${hh}:${mm}:${ss}`
    }

    const lobbyLine = (g) => {
        const players = g.players?.length ?? 0
        const ready = g.players?.filter(p => p.ready).length ?? 0
        const packs = g.selectedPacks?.length ?? 0
        return [
            chalk.bold(g.lobbyId),
            `phase:${g.phase}`,
            `host:${g.host.slice(0, 6)}`,
            `players:${players}`,
            `ready:${ready}`,
            `packs:${packs}`,
        ].join(chalk.bold.gray(" | "))
    }

    const updateConsole = () => {
        const sockets = io.of("/").sockets.size
        const lobbies = games.size
        const uptime = fmtUptime(Date.now() - startedAt)

        const lobbyList =
            lobbies === 0
                ? chalk.gray("  (geen lobbies)")
                : [...games.values()]
                    .sort((a, b) => a.lobbyId.localeCompare(b.lobbyId))
                    .map(g => "  " + lobbyLine(g))
                    .join("\n")

        logUpdate([
            chalk.white.bgBlack(" CardMadness server ") + chalk.black.bgWhite(" 1.0.0 "),
            `${chalk.bold("Made with")} ${chalk.red("♥")} ${chalk.bold("by Chiel")}`,
            "",
            `${chalk.green("●")} ${chalk.bold("Sockets")}: ${sockets}`,
            `${chalk.cyan("●")} ${chalk.bold("Lobbies")}: ${lobbies}`,
            `${chalk.yellow("●")} ${chalk.bold("Uptime")}: ${uptime}`,
            "",
            chalk.bold("Lobbies:"),
            lobbyList,
        ].join("\n"))
    }

    updateConsole()
    return setInterval(updateConsole, intervalMs)
}
