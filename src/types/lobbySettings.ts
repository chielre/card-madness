export const LOBBY_SETTINGS_LIMITS = {
  roundTimeMinMs: 40_000,
  roundTimeMaxMs: 120_000,
  czarPickTimeMinMs: 60_000,
  czarPickTimeMaxMs: 120_000,
  roundCountMin: 3,
  roundCountMax: 12,
} as const

export type LobbySettings = {
  keepLobbyOpen: boolean
  roundTimeMs: number
  czarPickTimeMs: number
  roundCount: number
  personalizeCards: boolean
}

export type LobbySettingsInput = Partial<LobbySettings> | null | undefined

export const DEFAULT_LOBBY_SETTINGS: LobbySettings = {
  keepLobbyOpen: true,
  roundTimeMs: 90_000,
  czarPickTimeMs: 90_000,
  roundCount: 5,
  personalizeCards: true,
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
    personalizeCards: toBoolean(source.personalizeCards, DEFAULT_LOBBY_SETTINGS.personalizeCards),
  }
}
