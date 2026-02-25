import { createI18n } from "vue-i18n"

import * as localeNl from "./locales/nl.json"
import * as localeEn from "./locales/en.json"

import { resolveInitialLocale } from "./utils/locale"

const messages = {
    en: localeEn,
    nl: localeNl,
}

const availableLocales = Object.keys(messages)
const initialLocale = resolveInitialLocale(availableLocales, "en")

export const i18n = createI18n({
    locale: initialLocale,
    fallbackLocale: "en",
    messages,
})

export const supportedLocales = availableLocales
