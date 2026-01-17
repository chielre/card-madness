import type { Room } from '../types/Room.js'
import type { PhaseTimerEntry, RoundTimerEntry, SelectionLockEntry } from '../types/Timers.js'

export const games = new Map<string, Room>()
export const socketRooms = new Map<string, Set<string>>()
export const phaseTimers = new Map<string, PhaseTimerEntry>()
export const roundTimers = new Map<string, RoundTimerEntry>()
export const selectionLockTimers = new Map<
    string,
    Map<string, SelectionLockEntry>
>()
