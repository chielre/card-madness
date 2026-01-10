// server/utils/cards.js
import fs from "node:fs"
import path from "node:path"
import { packExists } from "./packs.js"

const PACKS_DIR = path.join(process.cwd(), "assets", "packs", "cards", "nl")

let _cardsByPack = null

function loadCardsByPack() {
    if (_cardsByPack) return _cardsByPack

    const files = fs
        .readdirSync(PACKS_DIR)
        .filter((f) => f.endsWith(".json"))

    _cardsByPack = Object.fromEntries(
        files.map((file) => {
            const packId = file.replace(/\.json$/i, "")
            const json = JSON.parse(fs.readFileSync(path.join(PACKS_DIR, file), "utf8"))
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
