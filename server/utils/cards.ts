import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { getPackById, packExists } from "./packs.js"
import type { BlackCard, WhiteCard } from "../types/Cards.js"
import type { PackCards } from "../types/Pack.js"
import type { Room } from "../types/Room.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..")

const DEFAULT_PACKS_DIR = path.join(PROJECT_ROOT, "packs")
const PACKS_DIR = (() => {
    const envPath = process.env.PACKS_DIR?.trim()
    if (!envPath) return DEFAULT_PACKS_DIR
    return path.isAbsolute(envPath) ? envPath : path.resolve(PROJECT_ROOT, envPath)
})()
const DEFAULT_LANGUAGE = "nl"

const cardsCacheByLanguage: Record<string, Record<string, PackCards>> = {}

const keyOf = (c: { pack: string; card_id: number }) => `${c.pack}:${c.card_id}`


export const buildWhitePool = (game: Room, language = DEFAULT_LANGUAGE) => {
    const packIds = (game.selectedPacks ?? []).filter(packExists)
    if (!packIds.length) return { error: "no_selected_packs" }

    const cardsByPack = loadCardsByPack(language)
    const eligiblePackIds = packIds.filter((packId) => cardsByPack[packId]?.white?.length)

    if (!eligiblePackIds.length) return { error: "no_white_cards" }
    return { packIds: eligiblePackIds, cardsByPack }
}


export const buildUsedWhiteSet = (game: Room) => {
    const used = new Set<string>()
    for (const p of game.players ?? []) {
        for (const c of p.white_cards ?? []) used.add(keyOf(c))
    }
    return used
}


function loadCardsByPack(language = DEFAULT_LANGUAGE) {
    if (cardsCacheByLanguage[language]) return cardsCacheByLanguage[language]

    if (!fs.existsSync(PACKS_DIR)) {
        cardsCacheByLanguage[language] = {}
        return cardsCacheByLanguage[language]
    }

    const packDirs = fs.readdirSync(PACKS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)

    const cardsByPack = Object.fromEntries(
        packDirs.flatMap((packId) => {
            const packDir = path.join(PACKS_DIR, packId)
            const cardsDir = path.join(packDir, "cards")
            const supported = getPackSupportedLanguages(packId)
            const fallbackLanguage = getPackFallbackLanguage(packId)
            const allowRequested = !supported || supported.includes(language)
            const requestedFile = allowRequested ? path.join(cardsDir, `${language}.json`) : null
            const fallbackFile = path.join(cardsDir, `${fallbackLanguage}.json`)
            const defaultFile = path.join(cardsDir, `${DEFAULT_LANGUAGE}.json`)
            const targetFile = (requestedFile && fs.existsSync(requestedFile))
                ? requestedFile
                : (fs.existsSync(fallbackFile) ? fallbackFile : (fs.existsSync(defaultFile) ? defaultFile : null))

            if (!targetFile) return []

            try {
                const raw = fs.readFileSync(targetFile, "utf8")
                const json = JSON.parse(raw) as PackCards
                return [[packId, json]]
            } catch {
                return []
            }
        })
    ) as Record<string, PackCards>

    cardsCacheByLanguage[language] = cardsByPack
    return cardsByPack
}

export const getCardsByPack = (language = DEFAULT_LANGUAGE) => loadCardsByPack(language)

export const getPackCards = (packId: string, language = DEFAULT_LANGUAGE) =>
    loadCardsByPack(language)[packId] ?? null


export const pickUniqueRandomBlackCard = (game: Room, language = DEFAULT_LANGUAGE): BlackCard | null => {
    const packIds = (game?.selectedPacks ?? []).filter(packExists)
    if (!packIds.length) return null

    const keyOf = (c: { pack: string; card_id: number }) => `${c.pack}:${c.card_id}`
    const rand = (max) => Math.floor(Math.random() * max)

    const rounds = Object.values(game.rounds ?? {}) as Array<{ blackCard?: BlackCard | null }>
    const used = new Set(
        rounds
            .map((r) => r?.blackCard)
            .filter(Boolean)
            .map(keyOf)
    )

    const cardsByPack = loadCardsByPack(language)
    const eligiblePackIds = packIds.filter((packId) => cardsByPack[packId]?.black?.length)
    if (!eligiblePackIds.length) return null

    const eligiblePacks = eligiblePackIds.filter((packId) => {
        const pack = cardsByPack[packId]
        return pack.black.some((_, card_id) => !used.has(keyOf({ pack: packId, card_id })))
    })
    if (!eligiblePacks.length) return null

    const pickedPackId = eligiblePacks[rand(eligiblePacks.length)]
    const pack = cardsByPack[pickedPackId]
    const availableIds = pack.black
        .map((_, card_id) => card_id)
        .filter((card_id) => !used.has(keyOf({ pack: pickedPackId, card_id })))
    if (!availableIds.length) return null

    const pickedId = availableIds[rand(availableIds.length)]
    return { pack: pickedPackId, card_id: pickedId }
}

export const resolveWhiteCardText = ({
    pack,
    card_id,
    name,
    names,
    language = DEFAULT_LANGUAGE,
}: {
    pack: string
    card_id: number
    name?: string
    names?: string[]
    language?: string
}) => {
    if (!packExists(pack)) return null
    const packJson = loadCardsByPack(language)[pack]
    const text = packJson?.white?.[card_id]
    if (!text) return null
    let nameIndex = 0
    const nameList = Array.isArray(names) ? names : null
    return text.replace(/:name/g, () => {
        if (nameList) {
            const value = nameList[nameIndex] ?? nameList[nameList.length - 1] ?? ""
            nameIndex += 1
            return value
        }
        return name ?? ""
    })
}

export const whiteCardExists = (pack: string, id: number, language = DEFAULT_LANGUAGE) => {
    const cards = loadCardsByPack(language)[pack]
    return Boolean(cards?.white?.[id])
}

export const blackCardExists = (pack: string, id: number, language = DEFAULT_LANGUAGE) => {
    const cards = loadCardsByPack(language)[pack]
    return Boolean(cards?.black?.[id])
}

export const _resetCardsCache = () => {
    for (const key of Object.keys(cardsCacheByLanguage)) {
        delete cardsCacheByLanguage[key]
    }
}

type PickableCard = { pack: string; card_id: number }

export const pickFairWhiteCard = ({
    packIds,
    cardsByPack,
    used,
    localUsed,
}: {
    packIds: string[]
    cardsByPack: Record<string, PackCards>
    used?: Set<string> | null
    localUsed?: Set<string> | null
}): PickableCard | null => {
    const rand = (max: number) => Math.floor(Math.random() * max)
    const keyOf = (c: PickableCard) => `${c.pack}:${c.card_id}`

    const eligiblePacks = packIds.filter((packId) => {
        const pack = cardsByPack[packId]
        if (!pack?.white?.length) return false
        return pack.white.some((_, card_id) => {
            const key = keyOf({ pack: packId, card_id })
            if (used?.has(key)) return false
            if (localUsed?.has(key)) return false
            return true
        })
    })

    if (!eligiblePacks.length) return null

    const pickedPackId = eligiblePacks[rand(eligiblePacks.length)]
    const pack = cardsByPack[pickedPackId]
    const availableIds = pack.white
        .map((_, card_id) => card_id)
        .filter((card_id) => {
            const key = keyOf({ pack: pickedPackId, card_id })
            if (used?.has(key)) return false
            if (localUsed?.has(key)) return false
            return true
        })

    if (!availableIds.length) return null
    const pickedId = availableIds[rand(availableIds.length)]
    return { pack: pickedPackId, card_id: pickedId }
}
const getPackFallbackLanguage = (packId: string) => {
    const pack = getPackById(packId)
    const fallback = pack?.language?.fallback
    if (typeof fallback === "string" && fallback.trim()) return fallback.trim()
    return DEFAULT_LANGUAGE
}

const getPackSupportedLanguages = (packId: string) => {
    const pack = getPackById(packId)
    const list = pack?.language?.supported_languages
    return Array.isArray(list) ? list : null
}
