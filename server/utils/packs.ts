import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..")

const PACKS_DIR = path.join(PROJECT_ROOT, "src", "assets", "packs")
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
