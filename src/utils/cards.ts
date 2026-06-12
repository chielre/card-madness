// cards.ts
import { getPackById } from "@/utils/packs"
import { getActiveLanguage } from "@/utils/activeLanguage"

type CardPackRaw = { black: string[]; white: string[] }

export type WhiteCardInput = {
    pack: string
    card_id: number
    name?: string
    names?: string[]
}

export type BlackCardInput = {
    pack: string
    card_id: number
    names?: string[]
}

export type ResolvedCard = WhiteCardInput & {
    text: string
}

type GlobJsonMap = Record<string, CardPackRaw>

const DEFAULT_LANGUAGE = "nl"

const cardJsons = import.meta.glob("/packs/*/cards/*.json", {
    eager: true,
    import: "default",
}) as GlobJsonMap

type CardsByPack = Record<string, CardPackRaw>
const cardsByLanguage: Record<string, CardsByPack> = {}

function parseCardPath(filePath: string) {
    const parts = filePath.split("/")
    const packId = parts[2] ?? ""
    const langFile = parts[4] ?? ""
    const language = langFile.replace(/\.json$/i, "")
    return { packId, language }
}

function buildCardsByLanguage() {
    if (Object.keys(cardsByLanguage).length) return

    for (const [path, json] of Object.entries(cardJsons)) {
        const { packId, language } = parseCardPath(path)
        if (!packId || !language) continue
        cardsByLanguage[language] = cardsByLanguage[language] ?? {}
        cardsByLanguage[language][packId] = json
    }
}

function getCardsByPack(language = DEFAULT_LANGUAGE): Record<string, CardPackRaw> {
    buildCardsByLanguage()
    const result: Record<string, CardPackRaw> = {}
    const packIds = new Set<string>()

    for (const packMap of Object.values(cardsByLanguage)) {
        Object.keys(packMap).forEach((packId) => packIds.add(packId))
    }

    for (const packId of packIds) {
        const pack = getPackById(packId)
        const supported = pack?.language?.supported_languages
        const allowRequested = !supported || supported.includes(language)
        const fallbackLanguage = pack?.language?.fallback?.trim() || DEFAULT_LANGUAGE
        const candidates = [
            allowRequested ? language : "",
            fallbackLanguage,
            DEFAULT_LANGUAGE,
        ].filter(Boolean)

        const picked = candidates
            .map((lang) => cardsByLanguage[lang]?.[packId])
            .find(Boolean)

        if (picked) result[packId] = picked
    }

    return result
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

function formatName(name?: string) {
    if (!name) return ""
    return `<span class="card-name">${escapeHtml(name)}</span>`
}

function formatAnswerHtml(answerHtml?: string) {
    const value = answerHtml && answerHtml.trim() ? answerHtml : "______"
    return `<span class="card-answer">${value}</span>`
}

function hydrate(text: string, name?: string, names?: string[], answerHtml?: string | string[]) {
    let nameIndex = 0
    let answerIndex = 0
    const hasNames = Array.isArray(names) && names.length > 0
    // Each :answer slot consumes the next entry of the answer array (mirrors :name).
    // A bare string fills every slot with the same value (legacy single-answer callers).
    const answers = Array.isArray(answerHtml) ? answerHtml : null
    return text
        .replace(/:name/g, () => {
            if (hasNames) {
                const value = names[nameIndex] ?? names[names.length - 1] ?? ""
                nameIndex += 1
                return formatName(value)
            }
            return formatName(name)
        })
        .replace(/:answer/g, () => {
            const value = answers ? answers[answerIndex] : (answerHtml as string | undefined)
            answerIndex += 1
            return formatAnswerHtml(value)
        })
}

/** Number of :answer slots a black card has (= the size of the set it expects). */
export function getBlackCardAnswerCount(card: BlackCardInput, language = getActiveLanguage()): number {
    const cardsByPack = getCardsByPack(language)
    const text = cardsByPack[card.pack]?.black?.[card.card_id]
    if (!text) return 0
    return (text.match(/:answer/g) ?? []).length
}

export function resolveWhiteCards(cards: WhiteCardInput[], language = getActiveLanguage()): ResolvedCard[] {
    const cardsByPack = getCardsByPack(language)

    return cards.map(({ pack, card_id, name, names }) => {
        if (!getPackById(pack)) throw new Error(`Unknown pack: ${pack}`)

        const packJson = cardsByPack[pack]
        if (!packJson) throw new Error(`Missing cards json for pack: ${pack}`)

        const text = packJson.white?.[card_id]
        if (!text) throw new Error(`Unknown white card_id ${card_id} in pack ${pack}`)

        return { pack: pack, card_id: card_id, name: name, text: hydrate(text, name, names) }
    })
}

export function resolveBlackCard(card: BlackCardInput, answerHtml?: string | string[], language = getActiveLanguage()): ResolvedCard {
    const cardsByPack = getCardsByPack(language)

    if (!getPackById(card.pack)) throw new Error(`Unknown pack: ${card.pack}`)

    const packJson = cardsByPack[card.pack]
    if (!packJson) throw new Error(`Missing cards json for pack: ${card.pack}`)

    const text = packJson.black?.[card.card_id]
    if (!text) throw new Error(`Unknown black card_id ${card.card_id} in pack ${card.pack}`)

    return { pack: card.pack, card_id: card.card_id, text: hydrate(text, undefined, card.names, answerHtml) }
}
