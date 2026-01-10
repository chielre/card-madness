<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue"
import { Sortable, Plugins } from "@shopify/draggable"
import CountdownTimer from "../../../components/CountdownTimer.vue"

import { useLobbyStore } from '@/store/LobbyStore'
const lobby = useLobbyStore()

const timerRef = ref<InstanceType<typeof CountdownTimer> | null>(null)


const runIntroAnimation = () => {

}


onMounted(() => {
    timerRef.value?.start(50)
})

defineExpose({ runIntroAnimation })
</script>


<template>
    <div class="flex justify-center items-center">

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
                        <li v-for="player in lobby.players" :key="player.id" class="group flex justify-between items-center gap-4 text-black text-xl font-bold p-2 rounded-xl even:bg-gray-100">
                            <div class="flex items-center gap-4">
                                <div class="inline-block flex-1 w-4 h-4 border-3 border-white outline-2 outline-black bg-green-500 rounded-full"></div>
                                <div>{{ player.name }}</div>

                            </div>
                            <div class="text-xs font-bold px-2 py-1 rounded-full bg-yellow-300 text-black border-2 border-b-4 border-black"> Card Czar </div>
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
