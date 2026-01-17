import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { PackMeta } from "../types/Pack.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..")

const DEFAULT_PACKS_DIR = path.join(PROJECT_ROOT, "packs")
const PACKS_DIR = (() => {
    const envPath = process.env.PACKS_DIR?.trim()
    if (!envPath) return DEFAULT_PACKS_DIR
    return path.isAbsolute(envPath) ? envPath : path.resolve(PROJECT_ROOT, envPath)
})()

let _packs: PackMeta[] | null = null

function loadPacks() {
    if (_packs) return _packs
    if (!fs.existsSync(PACKS_DIR)) {
        _packs = []
        return _packs
    }

    const entries = fs.readdirSync(PACKS_DIR, { withFileTypes: true })
    const packDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)

    _packs = packDirs.map((packId) => {
        const packJsonPath = path.join(PACKS_DIR, packId, "pack.json")
        let data: Record<string, unknown> = {}
        if (fs.existsSync(packJsonPath)) {
            try {
                const raw = fs.readFileSync(packJsonPath, "utf8").trim()
                data = raw ? JSON.parse(raw) : {}
            } catch {
                data = {}
            }
        }
        return { ...data, id: packId } as PackMeta
    })

    return _packs
}
export const getPacks = () => loadPacks()

export const getPackById = (id: string) => {
    if (!id) return null
    return loadPacks().find((p) => p.id === id) ?? null
}

export const packExists = (id: string) => !!getPackById(id)

// (optioneel) voor tests/dev
export const _resetPacksCache = () => {
    _packs = null
}
