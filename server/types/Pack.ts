export interface PackCards {
    black: string[]
    white: string[]
}

export interface PackTranslation {
    name?: string
    description?: string
}

export interface PackMeta {
    id: string
    name?: string
    description?: string
    translations?: Record<string, PackTranslation>
    nsfw?: boolean
    author?: {
        name?: string
        link?: string | null
    }
    language?: {
        fallback?: string
        supported_languages?: string[]
    }
    [key: string]: unknown
}
