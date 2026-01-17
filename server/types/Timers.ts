export type PhaseTimerEntry = {
    timer: ReturnType<typeof setTimeout>
    phase: string
    durationMs: number
    expiresAt: number
}

export type RoundTimerEntry = {
    timer: ReturnType<typeof setTimeout>
    round: number
    durationMs: number
    expiresAt: number
}

export type SelectionLockEntry = {
    timer: ReturnType<typeof setTimeout>
    durationMs: number
    expiresAt: number
}
