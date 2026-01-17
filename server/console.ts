import logUpdate from 'log-update'
import chalk from 'chalk'
import logSymbols from 'log-symbols';


export const startConsole = ({ io, games, phaseTimers, roundTimers, intervalMs = 500 }) => {
    const startedAt = Date.now()

    const fmtUptime = (ms) => {
        const s = Math.floor(ms / 1000)
        const hh = String(Math.floor(s / 3600)).padStart(2, "0")
        const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
        const ss = String(s % 60).padStart(2, "0")
        return `${hh}:${mm}:${ss}`
    }

    const updateConsole = () => {
        const sockets = io.of("/").sockets.size
        const lobbies = games.size
        const uptime = fmtUptime(Date.now() - startedAt)

        logUpdate([
            `${chalk.green("●")} ${chalk.bold("Sockets")}: ${sockets}`,
            `${chalk.cyan("●")} ${chalk.bold("Lobbies")}: ${lobbies}`,
            `${chalk.yellow("●")} ${chalk.bold("Uptime")}: ${uptime}`,

        ].join("\n"))
    }

    updateConsole()
    return setInterval(updateConsole, intervalMs)
}
