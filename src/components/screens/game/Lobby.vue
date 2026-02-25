<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'


import { useLobbyStore } from '@/store/LobbyStore'
import { useAudioStore } from '@/store/AudioStore'
import { useConnectionStore } from '@/store/ConnectionStore'
import { useUiStore } from '@/store/UiStore'
import { LOBBY_SETTINGS_LIMITS, normalizeLobbySettings } from '@/types/lobbySettings'
import type { LobbySettings } from '@/types/lobbySettings'


import { resolvePacks } from "@/utils/packs"

import Close from 'vue-material-design-icons/Close.vue';


import Tabs from "@/components/Tabs.vue"
import Tab from "@/components/Tab.vue"
import ToggleSwitch from "@/components/ui/ToggleSwitch.vue"
import BaseButton from "@/components/ui/BaseButton.vue"
import BaseSelect from "@/components/ui/BaseSelect.vue"
import CardPack from '@/components/CardPack.vue'

import ReadyListModal from '@/components/modals/game/ReadyListModal.vue'
import PackInfoModal from '@/components/modals/PackInfoModal.vue'

const lobby = useLobbyStore()
const audio = useAudioStore()
const ui = useUiStore()
const connection = useConnectionStore()
const router = useRouter()

const readyModalRef = ref<InstanceType<typeof ReadyListModal> | null>(null)
const packInfoModalRef = ref<InstanceType<typeof PackInfoModal> | null>(null)
const currentMusicPackId = ref<string | null>(null)
const lobbySettings = ref<LobbySettings>(normalizeLobbySettings(lobby.settings))

const selectedPackIds = computed(() => lobby.selectedPacks)
const resolvedPacks = computed(() => resolvePacks())
const canEditSettings = computed(() => lobby.getCurrentPlayerIsHost() && lobby.phase === 'lobby')
const roundTimeMinSeconds = Math.round(LOBBY_SETTINGS_LIMITS.roundTimeMinMs / 1000)
const roundTimeMaxSeconds = Math.round(LOBBY_SETTINGS_LIMITS.roundTimeMaxMs / 1000)
const czarPickMinSeconds = Math.round(LOBBY_SETTINGS_LIMITS.czarPickTimeMinMs / 1000)
const czarPickMaxSeconds = Math.round(LOBBY_SETTINGS_LIMITS.czarPickTimeMaxMs / 1000)
const roundCountMin = LOBBY_SETTINGS_LIMITS.roundCountMin
const roundCountMax = LOBBY_SETTINGS_LIMITS.roundCountMax

const toggleToBool = (value: 'on' | 'off') => value === 'on'
const boolToToggle = (value: boolean): 'on' | 'off' => value ? 'on' : 'off'
const formatSeconds = (ms: number) => `${Math.round(ms / 1000)}s`

type SelectOption = {
    value: number
    label: string
}

const buildSteppedOptions = ({
    min,
    max,
    step,
    current,
    label,
}: {
    min: number
    max: number
    step: number
    current: number
    label: (value: number) => string
}): SelectOption[] => {
    const options: SelectOption[] = []
    const normalizedStep = Math.max(1, Math.round(step))
    const start = min

    for (let value = start; value <= max; value += normalizedStep) {
        options.push({ value, label: label(value) })
    }

    if (!options.some((option) => option.value === max)) {
        options.push({ value: max, label: label(max) })
    }

    if (!options.some((option) => option.value === current)) {
        options.push({ value: current, label: label(current) })
    }

    return options.sort((a, b) => a.value - b.value)
}

const buildRangeOptions = ({
    min,
    max,
    current,
    label,
}: {
    min: number
    max: number
    current: number
    label: (value: number) => string
}): SelectOption[] => {
    const options: SelectOption[] = []
    for (let value = min; value <= max; value += 1) {
        options.push({ value, label: label(value) })
    }

    if (!options.some((option) => option.value === current)) {
        options.push({ value: current, label: label(current) })
    }

    return options.sort((a, b) => a.value - b.value)
}

type PackFilter = 'nsfw'

const activeFilters = ref<Set<PackFilter>>(new Set())

const toggleAll = () => {
    activeFilters.value = new Set()
}

const toggleFilter = (f: PackFilter) => {
    const next = new Set(activeFilters.value)
    next.has(f) ? next.delete(f) : next.add(f)
    activeFilters.value = next
}

const packPredicates: Record<PackFilter, (pack: any) => boolean> = {
    nsfw: (pack) => !!pack.nsfw,
}

const filteredPacks = computed(() => {
    const filters = [...activeFilters.value]
    if (filters.length === 0) return resolvedPacks.value

    return resolvedPacks.value.filter((pack) =>
        filters.some((f) => packPredicates[f](pack))
    )
})

const selectPack = (packId: string) => {
    if (!lobby.getCurrentPlayerIsHost()) return

    const exists = selectedPackIds.value.includes(packId)
    const next = exists
        ? selectedPackIds.value.filter((id) => id !== packId)
        : [...selectedPackIds.value, packId]

    lobby.setSelectedPacks(lobby.lobbyId, next)
}

const syncPackSelection = () => {
    const activeId = selectedPackIds.value.at(-1) ?? null

    if (!activeId) {
        currentMusicPackId.value = null
        audio.playLobby()
        return
    }

}

const copyLobbyLink = async () => {
    const route = router.resolve({
        name: 'game',
        params: { id: lobby.lobbyId }
    })

    const url = new URL(route.href, window.location.origin)
    await navigator.clipboard.writeText(url.toString())
}

const startGame = async () => {
    if (!lobby.getCurrentPlayerIsHost() && lobby.lobbyId != 'TEST01') return
    await connection.emitWithAck('room:phase-set', { lobbyId: lobby.lobbyId, phase: 'starting' })
}

const applyLobbySettings = async (partial: Partial<LobbySettings>) => {
    const next = normalizeLobbySettings({
        ...lobbySettings.value,
        ...partial,
    })

    lobbySettings.value = next
    lobby.setLobbySettings(next)

    if (!canEditSettings.value || !lobby.lobbyId) return
    const res = await lobby.updateLobbySettings(lobby.lobbyId, partial)
    if (!res?.error && res?.settings) {
        lobbySettings.value = normalizeLobbySettings(res.settings)
    }
}

const keepLobbyOpenToggle = computed<'on' | 'off'>({
    get: () => boolToToggle(lobbySettings.value.keepLobbyOpen),
    set: (value) => {
        void applyLobbySettings({ keepLobbyOpen: toggleToBool(value) })
    },
})

const personalizeCardsToggle = computed<'on' | 'off'>({
    get: () => boolToToggle(lobbySettings.value.personalizeCards),
    set: (value) => {
        void applyLobbySettings({ personalizeCards: toggleToBool(value) })
    },
})

const roundTimeOptions = computed<SelectOption[]>(() => buildSteppedOptions({
    min: LOBBY_SETTINGS_LIMITS.roundTimeMinMs,
    max: LOBBY_SETTINGS_LIMITS.roundTimeMaxMs,
    step: 30_000,
    current: lobbySettings.value.roundTimeMs,
    label: (value) => formatSeconds(value),
}))

const czarPickTimeOptions = computed<SelectOption[]>(() => buildSteppedOptions({
    min: LOBBY_SETTINGS_LIMITS.czarPickTimeMinMs,
    max: LOBBY_SETTINGS_LIMITS.czarPickTimeMaxMs,
    step: 30_000,
    current: lobbySettings.value.czarPickTimeMs,
    label: (value) => formatSeconds(value),
}))

const roundCountOptions = computed<SelectOption[]>(() => buildRangeOptions({
    min: roundCountMin,
    max: roundCountMax,
    current: lobbySettings.value.roundCount,
    label: (value) => `${value}`,
}))

const selectedRoundTimeMs = computed<number>({
    get: () => lobbySettings.value.roundTimeMs,
    set: (value) => {
        const next = Number(value)
        if (!Number.isFinite(next)) return
        void applyLobbySettings({ roundTimeMs: Math.round(next) })
    },
})

const selectedCzarPickTimeMs = computed<number>({
    get: () => lobbySettings.value.czarPickTimeMs,
    set: (value) => {
        const next = Number(value)
        if (!Number.isFinite(next)) return
        void applyLobbySettings({ czarPickTimeMs: Math.round(next) })
    },
})

const selectedRoundCount = computed<number>({
    get: () => lobbySettings.value.roundCount,
    set: (value) => {
        const next = Number(value)
        if (!Number.isFinite(next)) return
        void applyLobbySettings({ roundCount: Math.round(next) })
    },
})

const openPackInfo = (packId: string) => {
    packInfoModalRef.value?.open(packId)
}

const openReadyModal = () => {
    readyModalRef.value?.open()
}

const closeReadyModal = () => {
    readyModalRef.value?.reset()
}

const resetLobbyUi = (opts?: { keepReadyModal?: boolean }) => {
    activeFilters.value = new Set()
    packInfoModalRef.value?.close()
    if (!opts?.keepReadyModal) {
        readyModalRef.value?.reset()
    }
    currentMusicPackId.value = null
}

const canKickPlayer = (playerId: string) =>
    lobby.getCurrentPlayerIsHost() && playerId !== connection.getSocketSafe()?.id

const kickPlayer = async (playerId: string) => {
    if (!canKickPlayer(playerId)) return
    await lobby.kickPlayer(lobby.lobbyId, playerId)
}

watch(selectedPackIds, () => syncPackSelection(), { immediate: true })

watch(
    () => lobby.settings,
    (settings) => {
        lobbySettings.value = normalizeLobbySettings(settings)
    },
    { deep: true, immediate: true }
)

watch(
    () => lobby.phase,
    (phase, prev) => {
        if (phase === 'starting') {
            resetLobbyUi({ keepReadyModal: true })
            return
        }
        if (phase === 'lobby' || prev === 'starting') {
            resetLobbyUi()
        }
    }
)

watch(
    () => lobby.phaseTimeoutTick,
    () => {
        readyModalRef.value?.reset()
    }
)

defineExpose({ openReadyModal, closeReadyModal })

</script>

<template>
    <section ref="lobbyRootRef">


        <div class="flex justify-between items-center gap-4">

            <div class="p-4 flex-1 flex items-center gap-4">
                <img class="" width="150" src="../../../assets/images/logo.png" alt="" />
                <div class="flex gap-2 items-center">

                    <div class="border-2 border-b-4 border-black bg-white text-black  px-3 rounded-full font-bold"><span class="font-black">{{ lobby.players.length }}</span> {{ $t('players') }}</div>
                </div>
            </div>

            <div class="p-4 flex-1 flex items-center justify-end gap-4">

                <BaseButton size="md" color="pink" @click="ui.openSettings" icon="Cog"></BaseButton>
                <BaseButton size="md" color="pink" icon="Logout" @click="lobby.confirmLeaveLobby"></BaseButton>
            </div>

        </div>
        <div class="flex gap-6 mt-8">

            <!-- player list-->
            <div class="w-100 bg-white border-4 border-b-8 rounded-xl border-black p-4 flex justify-between flex-col">
                <ul class="space-y-2">
                    <li v-for="player in lobby.players" :key="player.id" class="group flex justify-between items-center gap-4 text-black text-2xl font-bold p-4 rounded-xl even:bg-gray-100">
                        <div class="flex items-center gap-4">
                            <div class="inline-block w-6 h-6 border-3 border-white outline-3 outline-black bg-green-500 rounded-full"></div>
                            <div>{{ player.name }}</div>
                        </div>
                        <div class="flex items-center gap-4 ">
                            <div class="flex gap-4 opacity-0 group-hover:opacity-100">
                                <button v-if="canKickPlayer(player.id)" type="button" class="flex items-center justify-center w-10 h-10 hover:bg-gray-200 rounded-lg" @click.stop="kickPlayer(player.id)">
                                    <Close />
                                </button>
                            </div>
                            <div v-if="player.id === lobby.host" class="text-sm font-black px-2 py-1 rounded-full bg-yellow-300 text-black border-4 border-b-8 border-black">
                                Host
                            </div>
                            <div v-else-if="player.id === connection.getSocketSafe()?.id" class="text-sm font-black px-2 py-1 rounded-full bg-gray-200 text-black  border-4 border-b-8 border-black">
                                {{ $t("you") }}
                            </div>

                        </div>

                    </li>
                </ul>
                <div class="p-4 bg-gray-100 rounded-xl">


                    <BaseButton class="w-full" size="sm" icon="ContentCopy" @click="copyLobbyLink">{{ $t('copy_link') }}</BaseButton>
                </div>
            </div>

            <!-- card decks -->
            <div class="w-full max-w-5xl bg-black/50 backdrop-blur-sm rounded-xl border-black p-4 transition-all">
                <div class="flex gap-2 justify-between">
                    <div class="flex-1 flex gap-3 mb-4 bg-black/50 p-4 rounded-xl text-white">
                        <button class="font-bold cursor-pointer" @click="toggleAll">
                            All
                        </button>

                        <button class="font-bold cursor-pointer" :class="activeFilters.has('nsfw') ? ' underline text-outline-black' : ''" @click="toggleFilter('nsfw')">
                            NSFW
                        </button>
                    </div>
                    <div class="mb-4 bg-black/50 p-4 rounded-xl text-white font-bold">
                        <div v-if="!selectedPackIds?.length || selectedPackIds.length <= 0">
                            {{ $t('packs_selected') }}: <span class="underline">{{ $t('all_packs') }}</span>
                        </div>
                        <div v-else-if="selectedPackIds?.length > 0">
                            {{ $t('packs_selected') }}: ({{ selectedPackIds.length ?? 0 }}/{{ resolvedPacks.length ?? 0 }})
                        </div>
                    </div>

                </div>
                <div class="grid grid-cols-4 grid-rows-2 auto-rows-max max-h-[calc(100vh-300px)] content-start overflow-y-auto overflow-x-visible gap-3 p-3">
                    <CardPack v-for="pack in filteredPacks" :pack="pack" :key="pack.id" :selected="selectedPackIds.includes(pack.id)" @click="selectPack(pack.id)" @show-info="openPackInfo" />
                </div>
            </div>


            <!-- lobby settings -->
            <div class="flex flex-col gap-4">

                <div class=" bg-white border-4 border-b-8 rounded-xl border-black p-6 text-black overflow-scroll-y max-h-full">
                    <Tabs>
                        <Tab name="lobby" label="Lobby">
                            <div class="space-y-6">
                                <div class="flex flex-col gap-4 items-start">
                                    <div>
                                        <h2 class="font-bold text-xl">Lobby blijft open</h2>
                                        <p class="mt-2">Als dit uit staat kunnen nieuwe spelers niet meer joinen zodra de game start.</p>
                                    </div>
                                    <ToggleSwitch class="mt-2" name="lobby-open-setting" v-model="keepLobbyOpenToggle" :disabled="!canEditSettings" />
                                </div>
                            </div>
                        </Tab>

                        <Tab name="game" label="Game">
                            <div class="space-y-6">
                                <div class="flex flex-col gap-4 items-start">
                                    <div>
                                        <h2 class="font-bold text-xl">Ronde tijd</h2>
                                        <p class="mt-2">{{ formatSeconds(lobbySettings.roundTimeMs) }} ({{ roundTimeMinSeconds }}s - {{ roundTimeMaxSeconds }}s)</p>
                                    </div>
                                    <BaseSelect
                                        v-model="selectedRoundTimeMs"
                                        :options="roundTimeOptions"
                                        :disabled="!canEditSettings"
                                        name="round-time-setting"
                                    />
                                </div>
                                <div class="flex flex-col gap-4 items-start">
                                    <div>
                                        <h2 class="font-bold text-xl">Czar kiestijd</h2>
                                        <p class="mt-2">{{ formatSeconds(lobbySettings.czarPickTimeMs) }} ({{ czarPickMinSeconds }}s - {{ czarPickMaxSeconds }}s)</p>
                                    </div>
                                    <BaseSelect
                                        v-model="selectedCzarPickTimeMs"
                                        :options="czarPickTimeOptions"
                                        :disabled="!canEditSettings"
                                        name="czar-pick-time-setting"
                                    />
                                </div>
                                <div class="flex flex-col gap-4 items-start">
                                    <div>
                                        <h2 class="font-bold text-xl">Aantal rondes</h2>
                                        <p class="mt-2">{{ lobbySettings.roundCount }} ({{ roundCountMin }} - {{ roundCountMax }})</p>
                                    </div>
                                    <BaseSelect
                                        v-model="selectedRoundCount"
                                        :options="roundCountOptions"
                                        :disabled="!canEditSettings"
                                        name="round-count-setting"
                                    />
                                </div>
                                <div class="flex flex-col gap-4 items-start">
                                    <div>
                                        <h2 class="font-bold text-xl">Personaliseer kaarten</h2>
                                        <p class="mt-2">Uit = gebruik een voorgedefinieerde namenlijst in plaats van spelersnamen.</p>
                                    </div>
                                    <ToggleSwitch class="mt-2" name="personalize-cards-setting" v-model="personalizeCardsToggle" :disabled="!canEditSettings" />
                                </div>
                            </div>
                        </Tab>
                    </Tabs>

                </div>


                <div v-if="lobby.getCurrentPlayerIsHost() || lobby.lobbyId == 'TEST01'">
                    <BaseButton size="lg" @click="startGame">{{ $t('start_game') }}</BaseButton>

                </div>
            </div>

        </div>


        <PackInfoModal ref="packInfoModalRef" />
        <ReadyListModal ref="readyModalRef" />



    </section>
</template>
