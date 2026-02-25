export function mapToObj<V>(m: Map<string, V>) {
    return Object.fromEntries(m.entries())
}

export function setToArr(s: Set<string>) {
    return Array.from(s.values())
}

export function mapSetToObj(m: Map<string, Set<string>>) {
    return Object.fromEntries(
        Array.from(m.entries()).map(([k, set]) => [k, setToArr(set)])
    )
}

export function mapMapToObj<V>(m: Map<string, Map<string, V>>) {
    return Object.fromEntries(
        Array.from(m.entries()).map(([k, inner]) => [k, mapToObj(inner)])
    )
}
