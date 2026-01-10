import packsRaw from "@/assets/packs/packs.json"

type PackExtension = {
    base_pack: string | null
    extension_subject: string | null
}

type PackStyle = {
    background: string
    logo: string
    partner_logo: string
    gradient_from: string,
    gradient_to: string,
    music: string
}

export type Pack = {
    id: string
    name: string
    weight?: number
    author?: string
    description?: string
    nsfw?: boolean,
    extension?: PackExtension
    style: PackStyle
}

export type ResolvedPack = Pack & {
    bgUrl: string
    logoUrl: string
    partnerUrl: string
    musicUrl: string
    weight: number
    description: string
}

type GlobMap = Record<string, string>

const bgImages = import.meta.glob("@/assets/images/packs/bg/*.png", {
    eager: true,
    import: "default",
}) as GlobMap

const logoImages = import.meta.glob("@/assets/images/packs/*.png", {
    eager: true,
    import: "default",
}) as GlobMap

const partnerImages = import.meta.glob("@/assets/images/packs/partner_logos/*.png", {
    eager: true,
    import: "default",
}) as GlobMap

const musicFiles = import.meta.glob("@/assets/audio/*.mp3", {
    eager: true,
    import: "default",
}) as GlobMap


let _cache: ResolvedPack[] | null = null

function key(path: string) {
    return `/src/${path.replace(/^\/?src\//, "").replace(/^\/?/, "")}`
}

function resolveAsset(map: GlobMap, relFromSrc: string): string {
    return map[key(relFromSrc)] ?? ""
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

export function resolvePacks(input: Pack[] = packsRaw as Pack[]): ResolvedPack[] {
    return input.map((pack) => {
        const bgUrl = resolveAsset(bgImages, `assets/images/packs/bg/${pack.style.background}`)
        const logoUrl = resolveAsset(logoImages, `assets/images/packs/${pack.style.logo}`)
        const partnerUrl = resolveAsset(
            partnerImages,
            `assets/images/packs/partner_logos/${pack.style.partner_logo}`
        )

        const musicFile = pack.style.music?.trim() ?? ""
        const musicUrl = musicFile
            ? resolveAsset(musicFiles, `assets/audio/${musicFile}`)
            : ""

        return {
            ...pack,
            bgUrl,
            logoUrl,
            partnerUrl,
            musicUrl,
            weight: pack.weight ?? 1,
            description: pack.description ?? "",
        }
    })
}

export default resolvePacks
