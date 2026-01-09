import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CARDS_ROOT = path.resolve(__dirname, '../../src/assets/packs/cards')

const cache = new Map()

const getCacheKey = (language, packId) => `${language}/${packId}`

export const loadPackCards = (language, packId) => {
    const lang = (language ?? '').toString().trim() || 'nl'
    const pack = (packId ?? '').toString().trim()
    if (!pack) return { black: [], white: [] }

    const key = getCacheKey(lang, pack)
    if (cache.has(key)) return cache.get(key)

    const filePath = path.join(CARDS_ROOT, lang, `${pack}.json`)
    try {
        const raw = fs.readFileSync(filePath, 'utf-8')
        const parsed = JSON.parse(raw)
        const normalized = {
            black: Array.isArray(parsed.black) ? parsed.black : [],
            white: Array.isArray(parsed.white) ? parsed.white : [],
        }
        cache.set(key, normalized)
        return normalized
    } catch {
        const fallback = { black: [], white: [] }
        cache.set(key, fallback)
        return fallback
    }
}

export const getRandomCard = ({ language, packId, type }) => {
    const cards = loadPackCards(language, packId)
    const list = type === 'black' ? cards.black : cards.white
    if (!list.length) return null
    return list[Math.floor(Math.random() * list.length)]
}
