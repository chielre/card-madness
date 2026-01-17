export interface PackCards {
    black: string[]
    white: string[]
}

export interface PackMeta {
    id: string
    name?: string
    description?: string
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
