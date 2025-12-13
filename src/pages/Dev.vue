<script setup lang="ts">
import { ref } from "vue";

import ToggleSwitch from "../components/ui/ToggleSwitch.vue"
import BaseButton from "../components/ui/BaseButton.vue"
import Tabs from "../components/Tabs.vue"
import Tab from "../components/Tab.vue"

type ToggleValue = "on" | "off";
const sound = ref<ToggleValue>("on");




</script>

<template>
    <div class="page-main min-h-screen flex justify-center items-center">
        <div class="bg-noise"></div>
        <div class="bg-grid"></div>
        <div class="max-w-3/4">
            <div class="flex justify-between items-center gap-4">
                <div>
                    <img class="" width="200" src="../assets/images/logo.png" alt="">


                </div>
                <div class="border-4 border-b-8 border-black bg-white text-2xl text-black font-black px-6 py-1 rounded-full">3 players</div>

            </div>
            <div class="grid grid-cols-9 gap-6 mt-8">

                <!-- player list -->
                <div class=" bg-white border-4 border-b-8 rounded-xl border-black p-4 col-span-2">
                    <ul class="space-y-2">
                        <li class="flex items-center gap-4 text-black text-2xl font-bold p-4 rounded-xl even:bg-gray-100">
                            <span class="inline-block w-6 h-6 border-4 border-white outline-3 outline-gray-600 rounded-full bg-green-500"></span>
                            <span>Chiel</span>
                            <span class="ml-auto text-lg font-black px-2 py-1 rounded-full bg-yellow-300 text-black border-4 border-b-8 border-black">
                                Host
                            </span>

                        </li>
                        <li class="flex items-center gap-4 text-black text-2xl font-bold p-4 rounded-xl even:bg-gray-100">
                            <span class="inline-block w-6 h-6 border-4 border-white outline-3 outline-gray-600 rounded-full bg-green-500"></span>
                            <span>NiekH</span>


                        </li>
                        <li class="flex items-center gap-4 text-black text-2xl font-bold p-4 rounded-xl even:bg-gray-100">
                            <span class="inline-block w-6 h-6 border-4 border-white outline-3 outline-gray-600 rounded-full bg-green-500"></span>
                            <span>NiekV</span>


                        </li>
                        <li class="flex w-full mt-8">
                            <BaseButton size="md" class="w-full">Uitnodigen</BaseButton>

                        </li>
                    </ul>
                </div>


                <!-- card decks -->
                <div class=" col-span-5  bg-white border-4 border-b-8 rounded-xl border-black p-4 transition-all">
                    <div class="grid grid-cols-3 gap-4">

                    </div>
                </div>

                <!-- lobby settings -->
                <div class="col-span-2  bg-white border-4 border-b-8 rounded-xl border-black p-6 text-black overflow-scroll-y max-h-full">


                    <Tabs>
                        <Tab name="lobby" label="Lobby">
                            <div class="space-y-6">
                                <div class="flex flex-col gap-4 items-start">
                                    <div>
                                        <h2 class="font-bold text-xl">Lobby blijft open</h2>
                                        <p class="mt-2">Spelers kunnen blijven joinen nadat de game is gestart. Wel zo handig als iemand er uit donderd.</p>
                                    </div>
                                    <ToggleSwitch class="mt-2" v-model="sound" name="sound-toggle2" />
                                </div>
                            </div>
                        </Tab>

                        <Tab name="game" label="Game">
                            <div class="space-y-6">
                                <div class="flex flex-col gap-4 items-start">
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <h2 class="font-bold text-xl">Personaliseer kaarten</h2>
                                            <div class="font-bold border-2 border-b-4 rounded-full px-2 py-0.5 text-xs">Onze keuze</div>
                                        </div>

                                        <p class="mt-2">Gebruik namen van spelers in deze lobby in beschikbare kaarten. Om je game een vleugje persoonlijkheid te geven!</p>
                                    </div>
                                    <ToggleSwitch class="mt-2" v-model="sound" name="sound-toggle" />
                                </div>
                                <div class="flex flex-col gap-4 items-start">
                                    <div>
                                        <h2 class="font-bold text-xl">Scoreboard</h2>
                                        <p class="mt-2">Laat een scoreboard voor, na en tijdens een spel zien. Beetje competitie kan geen kwaad! Toch?</p>
                                    </div>
                                    <ToggleSwitch class="mt-2" v-model="sound" name="sound-toggle2" />
                                </div>
                            </div>
                        </Tab>
                    </Tabs>










                </div>

            </div>
        </div>
    </div>

    <div class="fixed inset-0 z-50 flex items-center justify-center ">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        <div class="relative bg-white border-4 border-b-8 border-black rounded-2xl max-w-xl w-full mx-4 p-6 text-black shadow-2xl">


            <h3 class="text-2xl font-black text-center">Your game is ready</h3>

            <p class="mt-4 text-lg leading-relaxed text-center">Press the button below make to it happen</p>
            <div class="mt-6 justify-between flex items-center bg-gray-50 rounded-xl p-3">
                <div class=" grid grid-cols-5 items-center gap-4">
                    <div class="bg-white  rounded-lg flex items-center justify-center p-4 border-2 border-b-6">
                        <div class="font-black">Chiel</div>
                    </div>
                    <div class="bg-green-400 border-green-900 text-green-900  rounded-lg flex items-center justify-center p-4 border-2 border-b-6">
                        <div class="font-black">NiekH</div>
                    </div>
                    <div class="bg-green-400 border-green-900 text-green-900  rounded-lg flex items-center justify-center p-4 border-2 border-b-6">
                        <div class="font-black">NiekV</div>
                    </div>
                    <div class="bg-green-400 border-green-900 text-green-900  rounded-lg flex items-center justify-center p-4 border-2 border-b-6">
                        <div class="font-black">Elvira</div>
                    </div>
                    <div class="bg-white  rounded-lg flex items-center justify-center p-4 border-2 border-b-6">
                        <div class="font-black">Mark</div>
                    </div>
                    <div class="bg-white  rounded-lg flex items-center justify-center p-4 border-2 border-b-6">
                        <div class="font-black">Hannah</div>
                    </div>
                    <div class="bg-white  rounded-lg flex items-center justify-center p-4 border-2 border-b-6">
                        <div class="font-black">Anastasiia</div>
                    </div>
                    <div class="bg-green-400 border-green-900 text-green-900  rounded-lg flex items-center justify-center p-4 border-2 border-b-6">
                        <div class="font-black">Simba</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

</template>