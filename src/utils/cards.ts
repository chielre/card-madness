// cards.ts
import { getPackById } from "@/utils/packs"

type CardPackRaw = { black: string[]; white: string[] }

export type WhiteCardInput = {
    pack: string
    card_id: number
    name?: string
}

export type ResolvedCard = WhiteCardInput & {
    text: string
}

type GlobJsonMap = Record<string, CardPackRaw>

const cardJsons = import.meta.glob("@/assets/packs/cards/nl/*.json", {
    eager: true,
    import: "default",
}) as GlobJsonMap

let _cardsByPack: Record<string, CardPackRaw> | null = null

function toPackId(path: string) {
    return path.split("/").pop()!.replace(/\.json$/i, "")
}

function getCardsByPack(): Record<string, CardPackRaw> {
    if (_cardsByPack) return _cardsByPack

    _cardsByPack = Object.fromEntries(
        Object.entries(cardJsons).map(([path, json]) => [toPackId(path), json])
    )

    return _cardsByPack
}

function hydrate(text: string, name?: string) {
    return text.replace(/:name/g, name ?? "")
}

export function resolveWhiteCards(cards: WhiteCardInput[]): ResolvedCard[] {
    const cardsByPack = getCardsByPack()

    return cards.map(({ pack, card_id, name }) => {
        if (!getPackById(pack)) throw new Error(`Unknown pack: ${pack}`)

        const packJson = cardsByPack[pack]
        if (!packJson) throw new Error(`Missing cards json for pack: ${pack}`)

        const text = packJson.white?.[card_id]
        if (!text) throw new Error(`Unknown white card_id ${card_id} in pack ${pack}`)

        return { pack: pack, card_id: card_id, name: name, text: hydrate(text, name) }
    })
}
