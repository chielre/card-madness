const LOCALE_COOKIE_NAME = "cm_locale"

const readCookie = (name: string): string | null => {
    if (typeof document === "undefined") return null
    const prefix = `${name}=`
    const parts = document.cookie ? document.cookie.split("; ") : []
    for (const part of parts) {
        if (part.startsWith(prefix)) {
            return decodeURIComponent(part.slice(prefix.length))
        }
    }
    return null
}

const writeCookie = (name: string, value: string, maxAgeDays: number) => {
    if (typeof document === "undefined") return
    const maxAgeSeconds = Math.max(0, Math.floor(maxAgeDays * 24 * 60 * 60))
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=/; samesite=lax`
}

const normalizeLocale = (value: string, availableLocales: string[]): string | null => {
    if (!value) return null
    const normalized = value.toLowerCase()
    if (availableLocales.includes(normalized)) return normalized
    const base = normalized.split("-")[0]
    if (availableLocales.includes(base)) return base
    return null
}

export const getLocaleCookie = (availableLocales: string[]): string | null => {
    const raw = readCookie(LOCALE_COOKIE_NAME)
    if (!raw) return null
    return normalizeLocale(raw, availableLocales)
}

export const setLocaleCookie = (locale: string, maxAgeDays = 365) => {
    writeCookie(LOCALE_COOKIE_NAME, locale, maxAgeDays)
}

export const resolveBrowserLocale = (availableLocales: string[]): string | null => {
    if (typeof navigator === "undefined") return null
    const candidates = Array.isArray(navigator.languages) && navigator.languages.length
        ? navigator.languages
        : [navigator.language]

    for (const candidate of candidates) {
        if (!candidate) continue
        const normalized = normalizeLocale(candidate, availableLocales)
        if (normalized) return normalized
    }

    return null
}

export const resolveInitialLocale = (availableLocales: string[], fallback = "en") => {
    return getLocaleCookie(availableLocales) ?? resolveBrowserLocale(availableLocales) ?? fallback
}
