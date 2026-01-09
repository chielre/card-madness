<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue"
import { Sortable, Plugins } from "@shopify/draggable"

import CountdownTimer from "../components/CountdownTimer.vue"
import BaseButton from "../components/ui/BaseButton.vue"
import { useAudioStore } from "@/store/AudioStore"
import pop1 from "@/assets/audio/effects/pop-1.mp3"
import pop2 from "@/assets/audio/effects/pop-3.mp3"

const timerRef = ref<InstanceType<typeof CountdownTimer> | null>(null)
const handRef = ref<HTMLElement | null>(null)
const playRef = ref<HTMLElement | null>(null)
const sortableRef = ref<Sortable | null>(null)

const audioStore = useAudioStore()
const popSounds = [pop1, pop2]
const pickPop = () => popSounds[Math.floor(Math.random() * popSounds.length)]

function syncPlaySlotState() {
    if (!playRef.value) return
    const hasCard = !!playRef.value.querySelector(".draggable-card")
    playRef.value.classList.toggle("has-card", hasCard)
}

/* ---------- CONFIG ---------- */
const DRAG_DISTANCE = 120
const MAX_TRANSLATE = 14
const MAX_ROTATE = 12

/* ---------- DRAG STATE ---------- */
const drag = {
    source: null as HTMLElement | null,
    mirror: null as HTMLElement | null,
}
let lastPointerX = 0
let lastPointerY = 0

/* ---------- UTILS ---------- */
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
const hypot = (x: number, y: number) => Math.sqrt(x * x + y * y)

const LIFT_Y = -10
const FOLLOW_FACTOR = 0.55 // hoeveel hij echt meebeweegt (0..1)

let primingEl: HTMLElement | null = null
let startX = 0
let startY = 0
let activePointerId: number | null = null
let captured = false

function applyPriming(el: HTMLElement, dx: number, dy: number) {
    // kleine follow + vaste lift
    const tx = clamp(dx * FOLLOW_FACTOR, -MAX_TRANSLATE, MAX_TRANSLATE)
    const ty = LIFT_Y + clamp(dy * FOLLOW_FACTOR, -MAX_TRANSLATE, MAX_TRANSLATE)

    // SYMMETRISCH: rotatie puur op dx
    const strength = clamp(hypot(dx, dy) / DRAG_DISTANCE, 0, 1)
    const rot = clamp((dx / DRAG_DISTANCE) * MAX_ROTATE, -MAX_ROTATE, MAX_ROTATE) * strength

    el.style.setProperty("--p-tx", `${tx}px`)
    el.style.setProperty("--p-ty", `${ty}px`)
    el.style.setProperty("--p-rot", `${rot}deg`)
}

function clearPrimingStyles(el: HTMLElement) {
    el.classList.remove("drag--priming")
    el.style.removeProperty("--p-tx")
    el.style.removeProperty("--p-ty")
    el.style.removeProperty("--p-rot")
}

function detachPrimingListeners() {
    window.removeEventListener("pointermove", onPointerMove, true)
    window.removeEventListener("pointerup", onPointerUp, true)
    window.removeEventListener("pointercancel", onPointerUp, true)
    window.removeEventListener("blur", onPointerUp, true)
}

function cleanupPriming() {
    if (!primingEl) return

    clearPrimingStyles(primingEl)

    if (captured && activePointerId !== null) {
        try { primingEl.releasePointerCapture(activePointerId) } catch { }
    }

    primingEl = null
    activePointerId = null
    captured = false
}

function onPointerMove(e: PointerEvent) {
    if (!primingEl) return
    applyPriming(primingEl, e.clientX - startX, e.clientY - startY)
}

function onPointerUp() {
    cleanupPriming()
    detachPrimingListeners()
}

function onPointerDown(e: PointerEvent) {
    const el = (e.target as HTMLElement | null)?.closest?.(".draggable-card") as HTMLElement | null
    if (!el) return
    if (e.button !== 0 && e.pointerType === "mouse") return

    // Alleen op touch preventDefault (anders verdwijnt je click)
    if (e.pointerType !== "mouse") e.preventDefault()

    cleanupPriming()
    detachPrimingListeners()

    primingEl = el
    startX = e.clientX
    startY = e.clientY
    activePointerId = e.pointerId

    primingEl.classList.add("drag--priming")
    applyPriming(primingEl, 0, 0)

    // Alleen capture op touch/stylus (bij mouse vaak niet nodig en kan click gedoe geven)
    if (e.pointerType !== "mouse") {
        try {
            primingEl.setPointerCapture(e.pointerId)
            captured = true
        } catch { }
    }

    window.addEventListener("pointermove", onPointerMove, true)
    window.addEventListener("pointerup", onPointerUp, true)
    window.addEventListener("pointercancel", onPointerUp, true)
    window.addEventListener("blur", onPointerUp, true)
}

function getPointerPosition(evt: any) {
    const clientX = evt?.sensorEvent?.clientX
    const clientY = evt?.sensorEvent?.clientY
    if (typeof clientX === "number" && typeof clientY === "number") {
        lastPointerX = clientX
        lastPointerY = clientY
    }
    return { x: lastPointerX, y: lastPointerY }
}

function isOverPlaySlot(x: number, y: number) {
    if (!playRef.value) return false
    const elements = document.elementsFromPoint(x, y)
    return elements.some((el) => el === playRef.value || playRef.value!.contains(el))
}


/* ---------- SORTABLE ---------- */
onMounted(() => {
    if (!handRef.value || !playRef.value) return

    handRef.value.addEventListener("pointerdown", onPointerDown)
    playRef.value.addEventListener("pointerdown", onPointerDown)

    const sortable = new Sortable([handRef.value, playRef.value], {
        draggable: ".draggable-card",
        distance: DRAG_DISTANCE,
        plugins: [Plugins.SortAnimation],
        mirror: { constrainDimensions: true, appendTo: document.body },
    })

    sortable.on("drag:start", (evt: any) => {
        audioStore.playEffectOnce(pickPop(), 0.8)

        cleanupPriming()
        detachPrimingListeners()

        drag.source = evt.source as HTMLElement
        drag.source.classList.add("drag--source")
    })

    sortable.on("drag:move", (evt: any) => {
        getPointerPosition(evt)
    })

    sortable.on("sortable:sort", (evt: any) => {
        if (!playRef.value) return
        if (evt.overContainer !== playRef.value) return

        const source = evt.dragEvent?.source as HTMLElement | undefined
        if (!source || playRef.value.contains(source)) return

        const playCards = playRef.value.querySelectorAll(".draggable-card")
        if (playCards.length > 0) {
            evt.cancel()
        }
    })

    sortable.on("mirror:created", (evt: any) => {
        drag.mirror = evt.mirror as HTMLElement
        drag.mirror.classList.add("drag--mirror")
    })

    sortable.on("drag:stop", (evt: any) => {
        if (playRef.value && handRef.value && drag.source) {
            const { x, y } = getPointerPosition(evt)
            const overPlay = isOverPlaySlot(x, y)

            if (overPlay) {
                const existing = playRef.value.querySelector(".draggable-card")
                if (existing && existing !== drag.source) {
                    handRef.value.appendChild(existing)
                }
                playRef.value.appendChild(drag.source)
            } else {
                if (playRef.value.contains(drag.source)) {
                    handRef.value.appendChild(drag.source)
                }
            }
        }

        drag.source?.classList.remove("drag--source")
        drag.mirror?.classList.remove("drag--mirror")
        drag.source = null
        drag.mirror = null

        // safety cleanup
        cleanupPriming()
        detachPrimingListeners()
        syncPlaySlotState()
    })

    sortableRef.value = sortable
    syncPlaySlotState()
    timerRef.value?.start(50)
})

onBeforeUnmount(() => {
    sortableRef.value?.destroy()

    handRef.value?.removeEventListener("pointerdown", onPointerDown)
    playRef.value?.removeEventListener("pointerdown", onPointerDown)

    cleanupPriming()
    detachPrimingListeners()
})
</script>




<template>
    <div class="page-main min-h-screen flex justify-center items-center">
        <div class="bg-noise"></div>
        <div class="bg-grid opacity-50"></div>
        <div>

            <!-- timer -->
            <div class="absolute top-0 w-screen left-[50%] translate-x-[-50%] flex justify-between ">
                <div class="p-4 flex-1 flex items-center"> <img class="logo" width="150" src="../assets/images/logo.png" alt=""> </div>
                <div class="bg-[#2b0246] px-16 py-4 rounded-b-4xl border-2 border-black border-t-0">
                    <CountdownTimer ref="timerRef" :initial-seconds="34" :auto-start="false" />
                </div>
                <div class="p-4 flex-1 flex items-center justify-end gap-3">
                    <BaseButton size="md" icon="Music"> </BaseButton>
                    <BaseButton size="md" icon="Logout"> </BaseButton>
                </div>
            </div>

            <!-- players -->
            <div class="absolute left-0 top-[50%] translate-y-[-50%] flex gap-2">
                <div class="bg-white border-4 border-b-8 border-l-0 rounded-xl rounded-l-none border-black p-2 text-black">
                    <ul class="space-y-2">
                        <li class="group flex justify-between items-center gap-4 text-black text-xl font-bold p-2 rounded-xl even:bg-gray-100">
                            <div class="flex items-center gap-4">
                                <div class="inline-block flex-1 w-4 h-4 border-3 border-white outline-2 outline-black bg-green-500 rounded-full"></div>
                                <div>Chiel</div>
                            </div>
                            <div class="text-xs font-bold px-2 py-1 rounded-full bg-yellow-300 text-black border-2 border-b-4 border-black"> Card Czar </div>
                        </li>
                        <li class="group flex justify-between items-center gap-4 text-black text-xl font-bold p-2 rounded-xl even:bg-gray-100">
                            <div class="flex items-center gap-4">
                                <div class="inline-block flex-1 w-4 h-4 border-3 border-white outline-2 outline-black bg-yellow-500 rounded-full"></div>
                                <div>John</div>
                            </div>
                        </li>
                        <li class="group flex justify-between items-center gap-4 text-black text-xl font-bold p-2 rounded-xl even:bg-gray-100">
                            <div class="flex items-center gap-4">
                                <div class="inline-block flex-1 w-4 h-4 border-3 border-white outline-2 outline-black bg-green-500 rounded-full"></div>
                                <div>Doe</div>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>


            <div class="flex items-center">
                <div class="pr-10 bg-white border-2 border-b-5 rounded-xl border-black p-6 text-black">
                    <div class="madness-card card-black card-anim "> Can ________ hurry up? It takes so long! </div>
                </div>
                <div class="-ml-6 bg-[#2b0246]  grid grid-cols-5 gap-8 w-3xl border-4 backdrop-blur-sm rounded-xl border-black p-6 transition-all">
                    <div class="play-zone ">
                        <div ref="playRef" class="play-slot">
                            <div class="play-placeholder border-3 border-dashed border-white/60 rounded-xl text-white/70 px-6 py-8 text-center text-sm"> Sleep hier je kaart </div>
                        </div>
                    </div>
                    <div class="madness-card card-back card-responsive card-white">Seriously? You think we didnt suspect you would try this?</div>
                    <div class="madness-card card-back card-responsive card-white">No this card also doesn't have the value you look for</div>
                    <div class="madness-card card-back card-responsive card-white">Haha, almost but this card is blank so that you (a master hacker) cant look</div>
                    <div class="madness-card card-back card-responsive card-white">"A mad hacker" or something, even we dont know what this card contains</div>


                </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 flex justify-center ">
                <div ref="handRef" class="flex gap-2 z-10 relative">
                    <div class="madness-card card-white card-sm draggable-card"> Een politicus met een verstoord wereldbeeld </div>
                    <div class="madness-card card-white card-sm draggable-card"> kapotte wifi </div>
                    <div class="madness-card card-white card-sm draggable-card"> mijn hoge zelfbeeld </div>
                    <div class="madness-card card-white card-sm draggable-card"> een lege portemonnee </div>
                    <div class="madness-card card-white card-sm draggable-card"> de ex van :name </div>
                </div>
            </div>
        </div>
    </div>
</template>
