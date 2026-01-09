<script setup lang="ts">
import { onMounted, ref } from "vue";

import ToggleSwitch from "../components/ui/ToggleSwitch.vue"
import BaseButton from "../components/ui/BaseButton.vue"
import Tabs from "../components/Tabs.vue"
import Tab from "../components/Tab.vue"
import CountdownTimer from "../components/CountdownTimer.vue"

const timerRef = ref<InstanceType<typeof CountdownTimer> | null>(null)

onMounted(() => {
    timerRef.value?.start(35)
})
</script>

<template>
    <div class="page-main min-h-screen flex justify-center items-center">
        <div class="bg-noise"></div>
        <div class="bg-grid opacity-50"></div>

        <div>


            <!-- timer -->
            <div class="absolute top-0 left-[50%] translate-x-[-50%] flex items-center justify-center">

                <div class="bg-[#2b0246] px-16 py-4 rounded-b-4xl border-2 border-black border-t-0">
                    <CountdownTimer ref="timerRef" :initial-seconds="34" :auto-start="false" />
                </div>
            </div>



            <!-- players -->
            <div class="absolute left-0 top-[50%] translate-y-[-50%] flex gap-2">
                <div class=" bg-white border-4 border-b-8 rounded-xl rounded-l-none border-black p-2 text-black">

                    <ul class="space-y-2">
                        <li class="group flex justify-between items-center gap-4 text-black text-xl font-bold p-2 rounded-xl even:bg-gray-100">
                            <div class="flex items-center gap-4">
                                <div class="inline-block flex-1 w-4 h-4 border-3 border-white outline-2 outline-black bg-green-500 rounded-full"></div>
                                <div>Chiel</div>
                            </div>
                            <div class="text-xs font-bold px-2 py-1 rounded-full bg-yellow-300 text-black border-2 border-b-4 border-black">
                                Card cazar
                            </div>
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
                <div class="pr-12  bg-white border-4 border-b-8 rounded-xl border-black p-8 text-black">
                    <div class="madness-card card-black card-anim ">
                        Can ________ hurry up? It takes so long!
                    </div>
                </div>

                <div class="-ml-6 bg-[#2b0246] border-4 backdrop-blur-sm rounded-xl border-black p-4 transition-all">
                    <div class="grid grid-cols-5 gap-8 w-4xl p-5 rounded-xl">
                        <div class="madness-card card-white card-back card-responsive">
                            Een politicus met een verstoord wereldbeeld
                        </div>

                        <div class="madness-card card-white  card-responsive">
                            Een politicus met een verstoord wereldbeeld
                        </div>

                        <div class="madness-card card-white card-back card-responsive">
                            Chiel
                        </div>

                        <div class="madness-card card-white card-back card-responsive">
                            Chiel
                        </div>
                    </div>
                </div>
            </div>

            <div class="absolute bottom-0 left-[50%] translate-x-[-50%] overflow-hidden">




                <div class="flex gap-2 z-10 relative">
                    <div class="madness-card card-white card-sm">
                        Een politicus met een verstoord wereldbeeld
                    </div>
                    <div class="madness-card card-white card-sm">
                        kapotte wifi
                    </div>
                    <div class="madness-card card-white card-sm">
                        mijn hoge zelfbeeld
                    </div>
                    <div class="madness-card card-white card-sm">
                        een lege portemonnee
                    </div>
                    <div class="madness-card card-white card-sm">
                        de ex van :name
                    </div>
                </div>

            </div>
        </div>
    </div>
</template>

<style scoped></style>
