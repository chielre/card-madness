export const LOBBY_SETTINGS_LIMITS = {
    roundTimeMinMs: 40_000,
    roundTimeMaxMs: 120_000,
    czarPickTimeMinMs: 40_000,
    czarPickTimeMaxMs: 120_000,
    roundCountMin: 1,
    roundCountMax: 8,
    czarRatingTimeMinMs: 10_000,
    czarRatingTimeMaxMs: 120_000,
} as const

export const DEFAULT_LOBBY_SETTINGS = {
    keepLobbyOpen: true,
    roundTimeMs: 60_000,
    czarPickTimeMs: 60_000,
    roundCount: 5,
    cardSwapEnabled: true,
    czarRatingEnabled: false,
    czarRatingTimeMs: 30_000,
}

type LobbySettingsInput = {
    keepLobbyOpen?: boolean
    roundTimeMs?: number
    czarPickTimeMs?: number
    roundCount?: number
    cardSwapEnabled?: boolean
    czarRatingEnabled?: boolean
    czarRatingTimeMs?: number
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
    cardSwapEnabled: toBoolean(settings?.cardSwapEnabled, DEFAULT_LOBBY_SETTINGS.cardSwapEnabled),
    czarRatingEnabled: toBoolean(settings?.czarRatingEnabled, DEFAULT_LOBBY_SETTINGS.czarRatingEnabled),
    czarRatingTimeMs: normalizeMs(
        settings?.czarRatingTimeMs,
        DEFAULT_LOBBY_SETTINGS.czarRatingTimeMs,
        LOBBY_SETTINGS_LIMITS.czarRatingTimeMinMs,
        LOBBY_SETTINGS_LIMITS.czarRatingTimeMaxMs
    ),
})
