import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { packExists } from "./packs.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, "../..")

const CARDS_DIR = path.join(PROJECT_ROOT, "src", "assets", "packs", "cards", "nl")


let _cardsByPack = null

const keyOf = (c) => `${c.pack}:${c.card_id}`


export const buildWhitePool = (game) => {
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


export const buildUsedWhiteSet = (game) => {
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
    )

    return _cardsByPack
}

export const getCardsByPack = () => loadCardsByPack()

export const getPackCards = (packId) => loadCardsByPack()[packId] ?? null


export const pickUniqueRandomBlackCard = (game) => {
    const packIds = game?.selectedPacks ?? []
    if (!packIds.length) return null


    const keyOf = (c) => `${c.pack}:${c.card_id}`
    const rand = (max) => Math.floor(Math.random() * max)


    const used = new Set(
        Object.values(game.rounds ?? {})
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

export const resolveWhiteCardText = ({ pack, card_id, name }) => {
    if (!packExists(pack)) return null
    const packJson = loadCardsByPack()[pack]
    const text = packJson?.white?.[card_id]
    if (!text) return null
    return text.replace(/:name/g, name ?? "")
}

export const whiteCardExists = (pack, id) => {
    const cards = loadCardsByPack()[pack]
    return Boolean(cards?.white?.[id])
}

export const blackCardExists = (pack, id) => {
    const cards = loadCardsByPack()[pack]
    return Boolean(cards?.black?.[id])
}

export const _resetCardsCache = () => {
    _cardsByPack = null
}
