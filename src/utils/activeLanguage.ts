import { i18n } from "@/i18n"

/**
 * The language the current user picked, read straight from the active i18n
 * locale. Reading it through a function (instead of a constant) keeps card and
 * pack text reactive: when the locale ref changes, any computed/render that
 * called this re-runs and re-localizes.
 *
 * Works whether vue-i18n exposes `locale` as a ref (composition mode) or a
 * plain string (legacy mode).
 */
export function getActiveLanguage(): string {
    const locale = i18n.global.locale as unknown
    const value = typeof locale === "string" ? locale : (locale as { value?: string } | null)?.value
    return (value ?? "").trim() || "nl"
}
