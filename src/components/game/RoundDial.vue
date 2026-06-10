<script setup lang="ts">
import { computed } from "vue"

/**
 * Round indicator shaped like a hand-less clock / wheel of fortune.
 * One tick per game round; a fixed pointer at the top marks the current round.
 * The dial "clicks" around so the active round's tick sits under the pointer.
 */
const props = withDefaults(
    defineProps<{
        total: number
        current: number
    }>(),
    {
        total: 1,
        current: 1,
    }
)

const SIZE = 100
const CENTER = SIZE / 2
const TICK_OUTER = 40
const TICK_INNER = 30
const TICK_CURRENT_INNER = 24

const totalTicks = computed(() => Math.max(1, Math.round(props.total)))
const current = computed(() => Math.min(totalTicks.value, Math.max(1, Math.round(props.current))))
const step = computed(() => 360 / totalTicks.value)

type Tick = { x1: number; y1: number; x2: number; y2: number; state: "done" | "current" | "todo" }

const tickAt = (angleDeg: number, inner: number) => {
    // 0deg = top (12 o'clock), increasing clockwise
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return {
        outer: { x: CENTER + TICK_OUTER * Math.cos(rad), y: CENTER + TICK_OUTER * Math.sin(rad) },
        inner: { x: CENTER + inner * Math.cos(rad), y: CENTER + inner * Math.sin(rad) },
    }
}

const ticks = computed<Tick[]>(() =>
    Array.from({ length: totalTicks.value }, (_, i) => {
        const roundNumber = i + 1
        const state: Tick["state"] =
            roundNumber === current.value ? "current" : roundNumber < current.value ? "done" : "todo"
        const inner = state === "current" ? TICK_CURRENT_INNER : TICK_INNER
        const { outer, inner: innerPt } = tickAt(i * step.value, inner)
        return { x1: outer.x, y1: outer.y, x2: innerPt.x, y2: innerPt.y, state }
    })
)

// Rotate the dial so the current round's tick lands under the top pointer.
const rotation = computed(() => -(current.value - 1) * step.value)

const dialStyle = computed(() => ({
    transformBox: "view-box",
    transformOrigin: "50px 50px",
    transform: `rotate(${rotation.value}deg)`,
    transition: "transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)",
}))
</script>

<template>
  <div class="block">
    <svg :viewBox="`0 0 ${SIZE} ${SIZE}`" class="block w-full h-full" role="img" :aria-label="`Ronde ${current} van ${totalTicks}`">
        <!-- chunky bottom lip -->
        <circle :cx="CENTER" :cy="CENTER + 3" r="46" fill="#000" />
        <!-- clock face -->
        <circle :cx="CENTER" :cy="CENTER" r="46" fill="#fff" stroke="#000" stroke-width="3" />

        <!-- rotating dial -->
        <g :style="dialStyle">
            <line
                v-for="(tick, i) in ticks"
                :key="i"
                :x1="tick.x1"
                :y1="tick.y1"
                :x2="tick.x2"
                :y2="tick.y2"
                stroke-linecap="round"
                :stroke="tick.state === 'current' ? '#ec4899' : tick.state === 'done' ? '#2b0246' : '#cbcbd6'"
                :stroke-width="tick.state === 'current' ? 6 : 4"
            />
        </g>

        <!-- current round number -->
        <text
            :x="CENTER"
            :y="CENTER"
            text-anchor="middle"
            dominant-baseline="central"
            font-size="22"
            font-weight="900"
            fill="#2b0246"
        >
            {{ current }}
        </text>

        <!-- fixed pointer (wheel of fortune style) -->
        <polygon points="43,1 57,1 50,15" fill="#ec4899" stroke="#000" stroke-width="2" stroke-linejoin="round" />
    </svg>
  </div>
</template>
