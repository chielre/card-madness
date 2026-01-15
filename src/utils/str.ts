export function strLimit(value: unknown, limit = 100, end = '...') {
    if (value == null) return ''
    const str = String(value)

    if (str.length <= limit) return str
    const cut = Math.max(0, limit - end.length)

    return str.slice(0, cut) + end
}