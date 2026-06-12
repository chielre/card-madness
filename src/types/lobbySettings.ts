export const LOBBY_SETTINGS_LIMITS = {
  roundTimeMinMs: 40_000,
  roundTimeMaxMs: 120_000,
  czarPickTimeMinMs: 40_000,
  czarPickTimeMaxMs: 120_000,
  roundCountMin: 1,
  roundCountMax: 8,
  czarRatingTimeMinMs: 10_000,
  czarRatingTimeMaxMs: 120_000,
  selectionLockTimeMinMs: 2_000,
  selectionLockTimeMaxMs: 20_000,
} as const

export type LobbySettings = {
  keepLobbyOpen: boolean
  roundTimeMs: number
  czarPickTimeMs: number
  roundCount: number
  cardSwapEnabled: boolean
  czarRatingEnabled: boolean
  czarRatingTimeMs: number
  selectionLockTimeMs: number
}

export type LobbySettingsInput = Partial<LobbySettings> | null | undefined

export const DEFAULT_LOBBY_SETTINGS: LobbySettings = {
  keepLobbyOpen: true,
  roundTimeMs: 60_000,
  czarPickTimeMs: 60_000,
  roundCount: 2,
  cardSwapEnabled: true,
  czarRatingEnabled: true,
  czarRatingTimeMs: 30_000,
  selectionLockTimeMs: 10_000,
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const toNumber = (value: unknown, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const toBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback

const normalizeMs = (value: unknown, fallback: number, min: number, max: number) => {
  const next = Math.round(toNumber(value, fallback))
  return clamp(next, min, max)
}

export const normalizeLobbySettings = (input?: LobbySettingsInput): LobbySettings => {
  const source = input ?? {}
  return {
    keepLobbyOpen: toBoolean(source.keepLobbyOpen, DEFAULT_LOBBY_SETTINGS.keepLobbyOpen),
    roundTimeMs: normalizeMs(
      source.roundTimeMs,
      DEFAULT_LOBBY_SETTINGS.roundTimeMs,
      LOBBY_SETTINGS_LIMITS.roundTimeMinMs,
      LOBBY_SETTINGS_LIMITS.roundTimeMaxMs
    ),
    czarPickTimeMs: normalizeMs(
      source.czarPickTimeMs,
      DEFAULT_LOBBY_SETTINGS.czarPickTimeMs,
      LOBBY_SETTINGS_LIMITS.czarPickTimeMinMs,
      LOBBY_SETTINGS_LIMITS.czarPickTimeMaxMs
    ),
    roundCount: normalizeMs(
      source.roundCount,
      DEFAULT_LOBBY_SETTINGS.roundCount,
      LOBBY_SETTINGS_LIMITS.roundCountMin,
      LOBBY_SETTINGS_LIMITS.roundCountMax
    ),
    cardSwapEnabled: toBoolean(source.cardSwapEnabled, DEFAULT_LOBBY_SETTINGS.cardSwapEnabled),
    czarRatingEnabled: toBoolean(source.czarRatingEnabled, DEFAULT_LOBBY_SETTINGS.czarRatingEnabled),
    czarRatingTimeMs: normalizeMs(
      source.czarRatingTimeMs,
      DEFAULT_LOBBY_SETTINGS.czarRatingTimeMs,
      LOBBY_SETTINGS_LIMITS.czarRatingTimeMinMs,
      LOBBY_SETTINGS_LIMITS.czarRatingTimeMaxMs
    ),
    selectionLockTimeMs: normalizeMs(
      source.selectionLockTimeMs,
      DEFAULT_LOBBY_SETTINGS.selectionLockTimeMs,
      LOBBY_SETTINGS_LIMITS.selectionLockTimeMinMs,
      LOBBY_SETTINGS_LIMITS.selectionLockTimeMaxMs
    ),
  }
}
