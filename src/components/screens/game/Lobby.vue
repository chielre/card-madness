<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'


import { useLobbyStore } from '@/store/LobbyStore'
import { useAudioStore } from '@/store/AudioStore'
import { useUiStore } from '@/store/UiStore'
import type { LobbySettings } from '@/types/lobbySettings'


import { resolvePacks } from "@/utils/packs"

import Close from 'vue-material-design-icons/Close.vue';
import ChevronDown from 'vue-material-design-icons/ChevronDown.vue';


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
const router = useRouter()

const readyModalRef = ref<InstanceType<typeof ReadyListModal> | null>(null)
const packInfoModalRef = ref<InstanceType<typeof PackInfoModal> | null>(null)
const currentMusicPackId = ref<string | null>(null)
const lobbySettings = computed(() => lobby.settings)

const selectedPackIds = computed(() => lobby.selectedPacks)
const resolvedPacks = computed(() => resolvePacks())
const canEditSettings = computed(() => lobby.getCurrentPlayerIsHost() && lobby.phase === 'lobby')

const toggleToBool = (value: 'on' | 'off') => value === 'on'
const boolToToggle = (value: boolean): 'on' | 'off' => value ? 'on' : 'off'
const formatSeconds = (ms: number) => `${Math.round(ms / 1000)}s`

type SelectOption = {
    value: number
    label: string
}

const buildTimeOptions = (valuesMs: number[]): SelectOption[] =>
    valuesMs.map((value) => ({ value, label: formatSeconds(value) }))

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
    if (!lobby.getCurrentPlayerIsHost()) return
    await lobby.startGame()
}

const applyLobbySettings = async (partial: Partial<LobbySettings>) => {
    lobby.setLobbySettings(partial)

    if (!canEditSettings.value || !lobby.lobbyId) return
    await lobby.updateLobbySettings(lobby.lobbyId, partial)
}

const keepLobbyOpenToggle = computed<'on' | 'off'>({
    get: () => boolToToggle(lobbySettings.value.keepLobbyOpen),
    set: (value) => {
        void applyLobbySettings({ keepLobbyOpen: toggleToBool(value) })
    },
})

const cardSwapEnabledToggle = computed<'on' | 'off'>({
    get: () => boolToToggle(lobbySettings.value.cardSwapEnabled),
    set: (value) => {
        void applyLobbySettings({ cardSwapEnabled: toggleToBool(value) })
    },
})

const czarRatingEnabledToggle = computed<'on' | 'off'>({
    get: () => boolToToggle(lobbySettings.value.czarRatingEnabled),
    set: (value) => {
        void applyLobbySettings({ czarRatingEnabled: toggleToBool(value) })
    },
})

const roundTimeOptions: SelectOption[] = buildTimeOptions([40_000, 60_000, 120_000])

const czarPickTimeOptions: SelectOption[] = buildTimeOptions([40_000, 60_000, 120_000])

const roundCountOptions: SelectOption[] = [1, 2, 3, 4, 5, 6, 7, 8].map((value) => ({
    value,
    label: `${value}`,
}))

const czarRatingTimeOptions: SelectOption[] = buildTimeOptions([10_000, 30_000, 60_000, 120_000])

const selectionLockTimeOptions: SelectOption[] = buildTimeOptions([3_000, 5_000, 10_000, 15_000])

const selectedSelectionLockTimeMs = computed<number>({
    get: () => lobbySettings.value.selectionLockTimeMs,
    set: (value) => {
        const next = Number(value)
        if (!Number.isFinite(next)) return
        void applyLobbySettings({ selectionLockTimeMs: Math.round(next) })
    },
})

const selectedCzarRatingTimeMs = computed<number>({
    get: () => lobbySettings.value.czarRatingTimeMs,
    set: (value) => {
        const next = Number(value)
        if (!Number.isFinite(next)) return
        void applyLobbySettings({ czarRatingTimeMs: Math.round(next) })
    },
})

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

const canKickPlayer = (playerId: string) => lobby.canCurrentPlayerKickPlayer(playerId)

const kickPlayer = async (playerId: string) => {
    if (!canKickPlayer(playerId)) return
    await lobby.kickPlayer(lobby.lobbyId, playerId)
}

watch(selectedPackIds, () => syncPackSelection(), { immediate: true })

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

const settingsScrollRef = ref<HTMLElement | null>(null)
const settingsCanScroll = ref(false)
const settingsAtBottom = ref(true)

const updateSettingsScroll = () => {
    const el = settingsScrollRef.value
    if (!el) return
    settingsCanScroll.value = el.scrollHeight - el.clientHeight > 4
    settingsAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight <= 4
}

let settingsMutationObserver: MutationObserver | null = null

onMounted(() => {
    void nextTick(updateSettingsScroll)
    const el = settingsScrollRef.value
    if (el && typeof MutationObserver !== 'undefined') {
        settingsMutationObserver = new MutationObserver(() => {
            void nextTick(updateSettingsScroll)
        })
        settingsMutationObserver.observe(el, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class'],
        })
    }
    window.addEventListener('resize', updateSettingsScroll)
})

onBeforeUnmount(() => {
    settingsMutationObserver?.disconnect()
    settingsMutationObserver = null
    window.removeEventListener('resize', updateSettingsScroll)
})

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
                                {{ $t('host') }}
                            </div>
                            <div v-else-if="player.id === lobby.getCurrentSocketId()" class="text-sm font-black px-2 py-1 rounded-full bg-gray-200 text-black  border-4 border-b-8 border-black">
                                {{ $t("you") }}
                            </div>

                        </div>

                    </li>
                </ul>
                <div class="p-4 bg-gray-100 rounded-xl">


                    <BaseButton class="w-full" size="sm" icon="ContentCopy" @click="copyLobbyLink">{{ $t('copy_link') }}</BaseButton>
                </div>
            </div>

            <div class="w-full max-w-5xl bg-black/50 backdrop-blur-sm rounded-xl border-black p-4 transition-all">
                <div class="flex gap-2 justify-between">
                    <div class="flex-1 flex gap-3 mb-4 bg-black/50 p-4 rounded-xl text-white">
                        <button class="font-bold cursor-pointer" @click="toggleAll">
                            {{ $t('all_packs') }}
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


            <div class="flex flex-col gap-4 w-88 max-w-full">

                <div class="relative">
                    <div
                        ref="settingsScrollRef"
                        @scroll="updateSettingsScroll"
                        class="settings-scroll bg-white border-4 border-b-8 rounded-xl border-black p-6 text-black overflow-y-auto max-h-[calc(100vh-280px)]"
                    >
                        <Tabs>
                            <Tab name="lobby" :label="$t('settings_lobby_tab')">
                                <div class="space-y-5">
                                    <div class="flex flex-col gap-2 items-start">
                                        <div>
                                            <h2 class="font-bold text-lg">{{ $t('settings_lobby_open') }}</h2>
                                            <p class="mt-1 text-sm text-gray-600">{{ $t('settings_lobby_open_description') }}</p>
                                        </div>
                                        <ToggleSwitch class="mt-1" name="lobby-open-setting" v-model="keepLobbyOpenToggle" :disabled="!canEditSettings" />
                                    </div>
                                </div>
                            </Tab>

                            <Tab name="game" :label="$t('settings_game_tab')">
                                <div class="space-y-5">
                                    <div class="flex flex-col gap-2 items-start">
                                        <div>
                                            <h2 class="font-bold text-lg">{{ $t('settings_round_time') }}</h2>
                                            <p class="mt-1 text-sm text-gray-600">{{ $t('settings_round_time_description') }}</p>
                                        </div>
                                        <BaseSelect
                                            v-model="selectedRoundTimeMs"
                                            :options="roundTimeOptions"
                                            :disabled="!canEditSettings"
                                            name="round-time-setting"
                                        />
                                    </div>
                                    <div class="flex flex-col gap-2 items-start">
                                        <div>
                                            <h2 class="font-bold text-lg">{{ $t('settings_czar_pick_time') }}</h2>
                                            <p class="mt-1 text-sm text-gray-600">{{ $t('settings_czar_pick_time_description') }}</p>
                                        </div>
                                        <BaseSelect
                                            v-model="selectedCzarPickTimeMs"
                                            :options="czarPickTimeOptions"
                                            :disabled="!canEditSettings"
                                            name="czar-pick-time-setting"
                                        />
                                    </div>
                                    <div class="flex flex-col gap-2 items-start">
                                        <div>
                                            <h2 class="font-bold text-lg">{{ $t('settings_round_count') }}</h2>
                                            <p class="mt-1 text-sm text-gray-600">{{ $t('settings_round_count_description') }}</p>
                                        </div>
                                        <BaseSelect
                                            v-model="selectedRoundCount"
                                            :options="roundCountOptions"
                                            :disabled="!canEditSettings"
                                            name="round-count-setting"
                                        />
                                    </div>
                                    <div class="flex flex-col gap-2 items-start">
                                        <div>
                                            <h2 class="font-bold text-lg">{{ $t('settings_selection_lock_time') }}</h2>
                                            <p class="mt-1 text-sm text-gray-600">{{ $t('settings_selection_lock_time_description') }}</p>
                                        </div>
                                        <BaseSelect
                                            v-model="selectedSelectionLockTimeMs"
                                            :options="selectionLockTimeOptions"
                                            :disabled="!canEditSettings"
                                            name="selection-lock-time-setting"
                                        />
                                    </div>
                                    <div class="flex flex-col gap-2 items-start">
                                        <div>
                                            <h2 class="font-bold text-lg">{{ $t('settings_card_swap') }}</h2>
                                            <p class="mt-1 text-sm text-gray-600">{{ $t('settings_card_swap_description') }}</p>
                                        </div>
                                        <ToggleSwitch class="mt-1" name="card-swap-setting" v-model="cardSwapEnabledToggle" :disabled="!canEditSettings" />
                                    </div>
                                    <div class="flex flex-col gap-2 items-start">
                                        <div>
                                            <h2 class="font-bold text-lg">{{ $t('settings_czar_rating') }}</h2>
                                            <p class="mt-1 text-sm text-gray-600">{{ $t('settings_czar_rating_description') }}</p>
                                        </div>
                                        <ToggleSwitch class="mt-1" name="czar-rating-setting" v-model="czarRatingEnabledToggle" :disabled="!canEditSettings" />
                                    </div>
                                    <div v-if="lobbySettings.czarRatingEnabled" class="flex flex-col gap-2 items-start">
                                        <div>
                                            <h2 class="font-bold text-lg">{{ $t('settings_czar_rating_time') }}</h2>
                                            <p class="mt-1 text-sm text-gray-600">{{ $t('settings_czar_rating_time_description') }}</p>
                                        </div>
                                        <BaseSelect
                                            v-model="selectedCzarRatingTimeMs"
                                            :options="czarRatingTimeOptions"
                                            :disabled="!canEditSettings"
                                            name="czar-rating-time-setting"
                                        />
                                    </div>
                                </div>
                            </Tab>
                        </Tabs>
                    </div>

                    <div
                        v-show="settingsCanScroll && !settingsAtBottom"
                        class="pointer-events-none absolute inset-x-1 bottom-1 flex h-16 items-end justify-center rounded-b-xl bg-linear-to-t from-white via-white/90 to-transparent pb-2"
                    >
                        <span class="flex items-center gap-1 text-xs font-black text-gray-500 animate-bounce">
                            <ChevronDown :size="16" /> {{ $t('settings_more') }}
                        </span>
                    </div>
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
