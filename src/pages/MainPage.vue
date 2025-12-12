<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { playCue } from '@/audio/cues'

import BaseButton from '@/components/ui/BaseButton.vue'

const router = useRouter()

const CreateLobby = () => {
    playCue();
    router.push('lobby')
}
</script>


<template>
    <div class="page-main min-h-screen flex justify-center items-center">
        <div class="bg-noise"></div>
        <div class="bg-grid"></div>
        <div>
            <!-- Topbar -->
            <img class="logo" width="300" src="../assets/images/logo.png" alt="">
            <div class="mt-8 flex flex-col gap-4">
                <BaseButton @click="CreateLobby" size="lg">Create a lobby</BaseButton>
                <BaseButton size="lg">Join lobby</BaseButton>
            </div>

            <div class="flex gap-4 mt-8">

                <BaseButton size="md">Music</BaseButton>


            </div>
        </div>
    </div>

</template>
