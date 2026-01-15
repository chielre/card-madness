<script setup lang="tsx">
import InformationSymbol from 'vue-material-design-icons/InformationSymbol.vue';

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
    <div class="shrink-0 group h-[340px] w-full select-none relative rounded-xl border-2 border-black outline-2 outline-white/50 -outline-offset-8 p-8 overflow-hidden text-left transition transform hover:-translate-y-1 hover:shadow-xl active:scale-95  disabled:cursor-not-allowed" :class="selected ? 'scale-95 ring-8 ring-yellow-400/50' : ''" :style="{ backgroundImage: `linear-gradient(to bottom, ${pack.style.gradient_from}, ${pack.style.gradient_to})` }" :data-pack-id="pack.id" :data-selected="selected ? 'true' : 'false'">

        <div class="z-20 absolute inset-0 flex items-center justify-center backdrop-blur-xs bg-white/20" :class="selected ? 'block ' : 'hidden'">
            <div class="-rotate-20 text-white font-bold  text-outline-black" :class="selected ? 'text-2xl' : 'text-xl'">selected</div>
        </div>


        <button v-if="!selected" type="button" class="group-hover:translate-x-0 group-hover:translate-y-0 hover:bg-white hover:text-black delay-100 translate-x-20 -translate-y-20  transition-transform   z-10 absolute outline-1 -outline-offset-4 top-3 right-3 w-8 h-8 rounded-full text-xl bg-black  text-white  flex items-center justify-center" @click.stop="openInfo">
            <information-symbol />
        </button>

        <div class="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[150%] h-[150%] bg-center bg-repeat opacity-60 pointer-events-none -rotate-12" :style="{ backgroundImage: `url(${pack.bgUrl})`, backgroundSize: '100px' }"></div>
        <div class="relative text-white font-bold flex flex-col h-full items-center justify-between w-full ">


            <div class="relative group-hover:-translate-y-2 group-hover:scale-105 transition duration-250">
                <img width="180" :src="pack.logoUrl">
                <img v-if="pack.extension.base_pack" width="120" src="../assets/images/pack_extended.png" class=" absolute bottom-2 right-0 -rotate-12" alt="">
                <img v-if="pack.nsfw" width="60" src="../assets/images/pack_nsfw.png" class=" absolute bottom-2 left-3 rotate-12" alt="">
            </div>

            <div class="text-outline-black">
                {{ pack.extension.extension_subject ?? '' }}

            </div>


            <div v-if="pack.partnerUrl" class="flex gap-4 items-center group-hover:-translate-y-2 transition duration-250">
                <img class="" width="75" src="../assets/images/logo.png" alt="">
                <img class="" width="75" :src="pack.partnerUrl" alt="">
            </div>

            <div v-else class="group-hover:-translate-y-2 transition duration-250">
                <img class="" width="100" src="../assets/images/logo.png" alt="">
            </div>



        </div>
    </div>
</template>
