<script setup lang="tsx">
import InformationSymbol from 'vue-material-design-icons/InformationSymbol.vue';
import { strLimit } from "@/utils/str"

const props = defineProps<{
    pack: any;
    selected: boolean;
}>()

const emit = defineEmits<{
    (e: 'show-info', packId: string): void
}>()

const openInfo = () => {
    emit('show-info', props.pack.id)
}

</script>

<template>
    <div class="madness-pack shrink-0  aspect-[0.65/1]  w-full select-none relative rounded-xl border-2 border-black outline-2 outline-white/50 -outline-offset-8 p-8 overflow-hidden text-left transition transform hover:-translate-y-1  active:scale-95  disabled:cursor-not-allowed " :class="selected ? 'scale-95 ring-8 ring-yellow-400/50' : 'group hover:scale-105 hover:-rotate-2 hover:z-20 hover:shadow-2xl '" :style="{ backgroundImage: `linear-gradient(to bottom, ${pack.backgroundColors.join(', ')})` }" :data-pack-id="pack.id" :data-selected="selected ? 'true' : 'false'">

        <div class="z-20 absolute inset-0 flex items-center justify-center backdrop-blur-xs bg-white/20" :class="selected ? 'block ' : 'hidden'">
            <div class="-rotate-20 text-white font-bold  text-outline-black" :class="selected ? 'text-2xl' : 'text-xl'">selected</div>
        </div>


        <button v-if="!selected" type="button" class="group-hover:translate-x-0 group-hover:translate-y-0 hover:bg-white hover:text-black delay-100 translate-x-20 -translate-y-20  transition-transform   z-10 absolute outline-1 -outline-offset-4 top-3 right-3 w-8 h-8 rounded-full text-xl bg-black  text-white  flex items-center justify-center" @click.stop="openInfo">
            <information-symbol />
        </button>

        <div class="pack-background absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[150%] h-[150%] bg-center bg-repeat opacity-60 pointer-events-none -rotate-12" :style="{ backgroundImage: `url(${pack.bgUrl})`, backgroundSize: '100px' }"></div>
        <div class="relative text-white font-bold flex flex-col h-full items-center justify-between w-full ">

            <div v-if="pack.deprecated" class="group-hover:scale-0  transition duration-250 absolute bottom-0 left-0 text-xs right-0 z-10 bg-red-600 border-2 border-b-4 shadow-lg py-1 px-3 rotate-6 border-red-700 text-center rounded-xl">
                Leaving Soon
            </div>

            <div class="relative  group-hover:scale-110 transition duration-250">
                <img width="180" :src="pack.logoUrl">
                <img v-if="pack.nsfw" width="50" src="../assets/images/pack_nsfw.png" class=" absolute bottom-2 left-3 rotate-12" alt="">
            </div>

            <div class="group-hover:translate-y-24 group-hover:scale-0 transition duration-250">
                <div v-if="pack.partnerUrl" class="flex gap-2">
                    <img class="" width="75" src="../assets/images/logo.png" alt="">
                    <img class="" width="75" :src="pack.partnerUrl" alt="">
                </div>

                <div v-else>
                    <img class="" width="75" src="../assets/images/logo.png" alt="">
                </div>
            </div>




        </div>
        <div class="absolute left-0 bottom-0  group-hover:opacity-100 translate-y-24 group-hover:translate-y-0 opacity-0 transition duration-250 bg-linear-to-t from-black/80 to-black/0 p-6  ">
            <div class="flex gap-4 items-center">
                <div class="bg-white font-bold border-2 border-b-4 rounded-full px-2 py-0.5 text-xs" v-if="pack.nsfw">NSFW</div>
                <div class="bg-white font-bold border-2 border-b-4 rounded-full px-2 py-0.5 text-xs" v-if="pack.extension?.base_pack">extension</div>
            </div>
            <div class="mt-2 text-outline-black text-white font-black">
                {{ strLimit(pack.name) ?? '' }}
            </div>
            <div class="text-sm text-white font-bold mt-2 text-outline-black">

                {{ strLimit(pack.description) ?? '' }}

            </div>
        </div>
    </div>
</template>
