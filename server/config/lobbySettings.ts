export const LOBBY_SETTINGS_LIMITS = {
    roundTimeMinMs: 40_000,
    roundTimeMaxMs: 120_000,
    czarPickTimeMinMs: 60_000,
    czarPickTimeMaxMs: 120_000,
    roundCountMin: 3,
    roundCountMax: 12,
} as const

export const DEFAULT_LOBBY_SETTINGS = {
    keepLobbyOpen: true,
    roundTimeMs: 90_000,
    czarPickTimeMs: 90_000,
    roundCount: 5,
    personalizeCards: true,
}

type LobbySettingsInput = {
    keepLobbyOpen?: boolean
    roundTimeMs?: number
    czarPickTimeMs?: number
    roundCount?: number
    personalizeCards?: boolean
} | null | undefined

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const toBoolean = (value, fallback) =>
    typeof value === 'boolean' ? value : fallback

const toNumber = (value, fallback) => {
    const next = Number(value)
    return Number.isFinite(next) ? next : fallback
}

const normalizeMs = (value, fallback, min, max) =>
    clamp(Math.round(toNumber(value, fallback)), min, max)

export const normalizeLobbySettings = (settings?: LobbySettingsInput) => ({
    keepLobbyOpen: toBoolean(settings?.keepLobbyOpen, DEFAULT_LOBBY_SETTINGS.keepLobbyOpen),
    roundTimeMs: normalizeMs(
        settings?.roundTimeMs,
        DEFAULT_LOBBY_SETTINGS.roundTimeMs,
        LOBBY_SETTINGS_LIMITS.roundTimeMinMs,
        LOBBY_SETTINGS_LIMITS.roundTimeMaxMs
    ),
    czarPickTimeMs: normalizeMs(
        settings?.czarPickTimeMs,
        DEFAULT_LOBBY_SETTINGS.czarPickTimeMs,
        LOBBY_SETTINGS_LIMITS.czarPickTimeMinMs,
        LOBBY_SETTINGS_LIMITS.czarPickTimeMaxMs
    ),
    roundCount: normalizeMs(
        settings?.roundCount,
        DEFAULT_LOBBY_SETTINGS.roundCount,
        LOBBY_SETTINGS_LIMITS.roundCountMin,
        LOBBY_SETTINGS_LIMITS.roundCountMax
    ),
    personalizeCards: toBoolean(settings?.personalizeCards, DEFAULT_LOBBY_SETTINGS.personalizeCards),
})
