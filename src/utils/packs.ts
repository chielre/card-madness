export type PackTranslation = {
    name?: string
    description?: string
}

type PackMeta = {
    id?: string
    name?: string
    author?: {
        name?: string
        link?: string | null
    }
    description?: string
    translations?: Record<string, PackTranslation>
    nsfw?: boolean
    language?: {
        fallback?: string
        supported_languages?: string[]
    }
    background?: string[]
    gradient_from?: string
    gradient_to?: string
}

export type Pack = {
    id: string
    name: string
    author?: {
        name?: string
        link?: string | null
    }
    description?: string
    translations?: Record<string, PackTranslation>
    nsfw?: boolean
    language?: {
        fallback?: string
        supported_languages?: string[]
    }
    gradient_from: string
    gradient_to: string
}

export type ResolvedPack = Pack & {
    bgUrl: string
    logoUrl: string
    partnerUrl: string
    musicUrl: string
    backgroundColors: string[]
    deprecated: boolean
    deprecatedNote: string
}

import { getActiveLanguage } from "@/utils/activeLanguage"

type GlobMap = Record<string, string>

const packJsons = import.meta.glob("/packs/*/pack.json", {
    eager: true,
    import: "default",
}) as Record<string, PackMeta>

const bgImages = import.meta.glob("/packs/*/background.png", {
    eager: true,
    import: "default",
}) as GlobMap

const logoImages = import.meta.glob("/packs/*/logo.png", {
    eager: true,
    import: "default",
}) as GlobMap

const partnerImages = import.meta.glob("/packs/*/partner.png", {
    eager: true,
    import: "default",
}) as GlobMap

const musicFiles = import.meta.glob("/packs/*/music.mp3", {
    eager: true,
    import: "default",
}) as GlobMap

const deprecatedFiles = import.meta.glob("/packs/*/DEPRECATED.*", {
    eager: true,
    import: "default",
    query: "?raw",
}) as Record<string, string>

const DEFAULT_GRADIENT_FROM = "#111827"
const DEFAULT_GRADIENT_TO = "#4b5563"

let _cache: ResolvedPack[] | null = null

function packIdFromPath(filePath: string) {
    return filePath.split("/")[2] ?? ""
}

function mapAssetsByPack(globMap: GlobMap) {
    return Object.fromEntries(
        Object.entries(globMap)
            .map(([path, url]) => [packIdFromPath(path), url])
            .filter(([packId]) => Boolean(packId))
    ) as Record<string, string>
}

function normalizeBackgroundColors(meta: PackMeta): string[] {
    const input = Array.isArray(meta.background) ? meta.background : []
    const colors = input.map((value) => String(value).trim()).filter(Boolean)
    if (colors.length >= 2) return colors
    if (colors.length === 1) return [colors[0], colors[0]]

    const fallbackFrom = meta.gradient_from ?? DEFAULT_GRADIENT_FROM
    const fallbackTo = meta.gradient_to ?? DEFAULT_GRADIENT_TO
    return [fallbackFrom, fallbackTo]
}

function clampDeprecatedNote(raw: string, maxWords = 500) {
    const words = raw.trim().split(/\s+/).filter(Boolean)
    if (words.length <= maxWords) return words.join(" ")
    return `${words.slice(0, maxWords).join(" ")}...`
}

function getResolvedBase(): ResolvedPack[] {
    if (!_cache) _cache = buildBasePacks()
    return _cache
}

/**
 * Overlays the name/description for the user's active language on top of a
 * pack. The top-level `name`/`description` act as the fallback, so a pack
 * without a matching translation keeps showing its default text. We try the
 * active language first, then the pack's own fallback language, then the
 * baked-in fallback. Reading the active language here (not at build time)
 * keeps pack text reactive when the locale switches.
 */
function localizePack(pack: ResolvedPack): ResolvedPack {
    const language = getActiveLanguage()
    const fallbackLanguage = pack.language?.fallback?.trim()
    const translations = pack.translations ?? {}

    const pick = (field: keyof PackTranslation, fallback: string) =>
        translations[language]?.[field]?.trim()
        || (fallbackLanguage ? translations[fallbackLanguage]?.[field]?.trim() : "")
        || fallback

    return {
        ...pack,
        name: pick("name", pack.name),
        description: pick("description", pack.description ?? ""),
    }
}

export function getPackById(id: string): ResolvedPack | null {
    const pack = getResolvedBase().find(p => p.id === id)
    return pack ? localizePack(pack) : null
}

export function getPackByName(name: string): ResolvedPack | null {
    const needle = name.trim().toLowerCase()

    const pack = getResolvedBase().find(p =>
        p.name.trim().toLowerCase() === needle
    )
    return pack ? localizePack(pack) : null
}

function buildBasePacks(): ResolvedPack[] {
    const bgMap = mapAssetsByPack(bgImages)
    const logoMap = mapAssetsByPack(logoImages)
    const partnerMap = mapAssetsByPack(partnerImages)
    const musicMap = mapAssetsByPack(musicFiles)
    const deprecatedMap = Object.fromEntries(
        Object.entries(deprecatedFiles).map(([path, raw]) => [packIdFromPath(path), raw])
    ) as Record<string, string>

    return Object.entries(packJsons).map(([path, meta]) => {
        const packId = packIdFromPath(path)
        const name = meta.name ?? packId
        const backgroundColors = normalizeBackgroundColors(meta)

        return {
            id: packId,
            name,
            author: meta.author,
            description: meta.description ?? "",
            translations: meta.translations,
            nsfw: meta.nsfw ?? false,
            language: meta.language,
            gradient_from: meta.gradient_from ?? DEFAULT_GRADIENT_FROM,
            gradient_to: meta.gradient_to ?? DEFAULT_GRADIENT_TO,
            bgUrl: bgMap[packId] ?? "",
            logoUrl: logoMap[packId] ?? "",
            partnerUrl: partnerMap[packId] ?? "",
            musicUrl: musicMap[packId] ?? "",
            backgroundColors,
            deprecated: Boolean(deprecatedMap[packId]),
            deprecatedNote: deprecatedMap[packId]
                ? clampDeprecatedNote(deprecatedMap[packId])
                : "",
        }
    })
}

export function resolvePacks(): ResolvedPack[] {
    return getResolvedBase().map(localizePack)
}

export default resolvePacks
