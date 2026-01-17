type PackMeta = {
    id?: string
    name?: string
    author?: {
        name?: string
        link?: string | null
    }
    description?: string
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
}

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

const deprecatedFiles = import.meta.glob("/packs/*/DEPRECATED.md", {
    eager: true,
    import: "default",
}) as GlobMap

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

function getResolved(): ResolvedPack[] {
    if (!_cache) _cache = resolvePacks()
    return _cache
}

export function getPackById(id: string): ResolvedPack | null {
    return getResolved().find(p => p.id === id) ?? null
}

export function getPackByName(name: string): ResolvedPack | null {
    const needle = name.trim().toLowerCase()

    return getResolved().find(p =>
        p.name.trim().toLowerCase() === needle
    ) ?? null
}

export function resolvePacks(): ResolvedPack[] {
    const bgMap = mapAssetsByPack(bgImages)
    const logoMap = mapAssetsByPack(logoImages)
    const partnerMap = mapAssetsByPack(partnerImages)
    const musicMap = mapAssetsByPack(musicFiles)
    const deprecatedMap = mapAssetsByPack(deprecatedFiles)

    return Object.entries(packJsons).map(([path, meta]) => {
        const packId = packIdFromPath(path)
        const name = meta.name ?? packId
        const backgroundColors = normalizeBackgroundColors(meta)

        return {
            id: packId,
            name,
            author: meta.author,
            description: meta.description ?? "",
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
        }
    })
}

export default resolvePacks
