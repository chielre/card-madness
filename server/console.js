import logUpdate from 'log-update'
import chalk from 'chalk'

export const startConsole = ({ io, games, phaseTimers, intervalMs = 500 }) => {
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

    const phaseTimerLine = (roomId, entry) => {
        const remainingMs = entry?.expiresAt ? Math.max(0, entry.expiresAt - Date.now()) : null
        const remaining = remainingMs !== null ? `${Math.ceil(remainingMs / 1000)}s` : 'n/a'
        return [
            chalk.bold(roomId),
            `phase:${entry?.phase ?? '?'}`,
            `remaining:${remaining}`,
        ].join(chalk.bold.gray(" | "))
    }


    const updateConsole = () => {
    


        const sockets = io.of("/").sockets.size
        const lobbies = games.size
        const timers = phaseTimers.size
        const uptime = fmtUptime(Date.now() - startedAt)

        const lobbyList =
            lobbies === 0
                ? chalk.gray("  (geen lobbies)")
                : [...games.values()]
                    .sort((a, b) => a.lobbyId.localeCompare(b.lobbyId))
                    .map(g => "  " + lobbyLine(g))
                    .join("\n")

        const phaseTimersList =
            timers === 0
                ? chalk.gray("  (geen timers)")
                : [...phaseTimers.entries()]
                    .map(([roomId, entry]) => "  " + phaseTimerLine(roomId, entry))
                    .join("\n")

        logUpdate([
            `${chalk.white.bgBlack(" CardMadness server ")} ${chalk.black.bgWhite(" 1.0.0 ")}`,
            `${chalk.bold("Made with")} ${chalk.red("♥")} ${chalk.bold("by Chiel")} \n`,
            `${chalk.green("●")} ${chalk.bold("Sockets")}: ${sockets}`,
            `${chalk.cyan("●")} ${chalk.bold("Lobbies")}: ${lobbies}`,
            `${chalk.yellow("●")} ${chalk.bold("Uptime")}: ${uptime}`,
            `${chalk.bold("Lobbies:")}`,
            `${lobbyList}`,
            `${chalk.bold("Phase timers:")}`,
            `${phaseTimersList}`
        ].join("\n"))
    }

    updateConsole()
    return setInterval(updateConsole, intervalMs)
}
