import fs from "node:fs"
import path from "node:path"

const PACKS_DIR = path.join(process.cwd(), "assets", "packs")
const PACKS_META_FILE = path.join(PACKS_DIR, "packs.json")

let _packs = null

function loadPacks() {
    if (_packs) return _packs

    const raw = fs.readFileSync(PACKS_META_FILE, "utf8")
    _packs = JSON.parse(raw)

    return _packs
}

export const getPacks = () => loadPacks()

export const getPackById = (id) => {
    if (!id) return null
    return loadPacks().find((p) => p.id === id) ?? null
}

export const packExists = (id) => !!getPackById(id)

// (optioneel) voor tests/dev
export const _resetPacksCache = () => {
    _packs = null
}
