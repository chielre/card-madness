// ./utils/monitoring.ts
import type { IncomingMessage, ServerResponse } from "node:http";
import client from "prom-client";
import { createServer } from "http";

export function createMonitoring(opts: {
    getLobbiesCount: () => number;
    getSocketsCount: () => number;
    updateIntervalMs?: number;
    metricsPath?: string;
    metricsHost?: string;
    metricsPort?: number;
}) {
    const {
        getLobbiesCount,
        getSocketsCount,
        updateIntervalMs = 1000,
        metricsPath = "/metrics",
        metricsHost = "127.0.0.1",
        metricsPort = 9100
    } = opts;

    const register = new client.Registry();

    const lobbyGauge = new client.Gauge({
        name: "card_madness_lobbies_total",
        help: "Number of active lobbies",
        registers: [register],
    });

    const socketGauge = new client.Gauge({
        name: "card_madness_sockets_total",
        help: "Number of connected sockets",
        registers: [register],
    });

    const timer = setInterval(() => {
        try {
            lobbyGauge.set(getLobbiesCount());
            socketGauge.set(getSocketsCount());
        } catch {
        }
    }, updateIntervalMs);

    if (typeof timer?.unref === "function") timer.unref();





    async function handleHttp(req: IncomingMessage, res: ServerResponse) {
        if (!req.url) return false;

        const url = req.url.split("?")[0];
        if (url !== metricsPath) return false;

        try {
            const body = await register.metrics();
            res.statusCode = 200;
            res.setHeader("Content-Type", register.contentType);
            res.end(body);
        } catch (e) {
            res.statusCode = 500;
            res.end("metrics error");
        }
        return true;
    }

    const metricsServer = createServer(async (req, res) => {
        const handled = await handleHttp(req, res);
        if (!handled && !res.writableEnded) {
            res.statusCode = 404;
            res.end("not found");
        }
    });

    metricsServer.listen(metricsPort, metricsHost);

    function stop() {
        clearInterval(timer);
    }

    return {  stop, register };
}
