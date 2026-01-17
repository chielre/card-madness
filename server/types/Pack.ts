export interface PackCards {
    black: string[]
    white: string[]
}

export interface PackMeta {
    id: string
    name?: string
    language?: string
    [key: string]: unknown
}
