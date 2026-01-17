import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { packExists } from "./packs.js"
import type { BlackCard, WhiteCard } from "../types/Cards.js"
import type { PackCards } from "../types/Pack.js"
import type { Room } from "../types/Room.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..")

const CARDS_DIR = path.join(PROJECT_ROOT, "src", "assets", "packs", "cards", "nl")


let _cardsByPack: Record<string, PackCards> | null = null

const keyOf = (c: { pack: string; card_id: number }) => `${c.pack}:${c.card_id}`


export const buildWhitePool = (game: Room) => {
    const packIds = (game.selectedPacks ?? []).filter(packExists)
    if (!packIds.length) return { error: "no_selected_packs" }

    const cardsByPack = loadCardsByPack()

    const pool = packIds.flatMap((packId) => {
        const pack = cardsByPack[packId]
        if (!pack?.white?.length) return []
        return pack.white.map((_, card_id) => ({ pack: packId, card_id }))
    })

    if (!pool.length) return { error: "no_white_cards" }
    return { pool }
}


export const buildUsedWhiteSet = (game: Room) => {
    const used = new Set()
    for (const p of game.players ?? []) {
        for (const c of p.white_cards ?? []) used.add(keyOf(c))
    }
    return used
}


function loadCardsByPack() {
    if (_cardsByPack) return _cardsByPack



    const files = fs
        .readdirSync(CARDS_DIR)
        .filter((f) => f.endsWith(".json"))

    _cardsByPack = Object.fromEntries(
        files.map((file) => {
            const packId = file.replace(/\.json$/i, "")
            const json = JSON.parse(fs.readFileSync(path.join(CARDS_DIR, file), "utf8"))
            return [packId, json] // { black:[], white:[] }
        })
    ) as Record<string, PackCards>

    return _cardsByPack
}

export const getCardsByPack = () => loadCardsByPack()

export const getPackCards = (packId: string) => loadCardsByPack()[packId] ?? null


export const pickUniqueRandomBlackCard = (game: Room): BlackCard | null => {
    const packIds = game?.selectedPacks ?? []
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

    const cardsByPack = loadCardsByPack()

    const pool = packIds.flatMap((packId) => {
        if (!packExists(packId)) return []
        const pack = cardsByPack[packId]
        if (!pack?.black?.length) return []

        return pack.black
            .map((_, card_id) => ({ pack: packId, card_id }))
            .filter((c) => !used.has(keyOf(c)))
    })

    if (!pool.length) return null
    return pool[rand(pool.length)]
}

export const resolveWhiteCardText = ({
    pack,
    card_id,
    name,
    names,
}: {
    pack: string
    card_id: number
    name?: string
    names?: string[]
}) => {
    if (!packExists(pack)) return null
    const packJson = loadCardsByPack()[pack]
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

export const whiteCardExists = (pack: string, id: number) => {
    const cards = loadCardsByPack()[pack]
    return Boolean(cards?.white?.[id])
}

export const blackCardExists = (pack: string, id: number) => {
    const cards = loadCardsByPack()[pack]
    return Boolean(cards?.black?.[id])
}

export const _resetCardsCache = () => {
    _cardsByPack = null
}
