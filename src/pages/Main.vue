<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUiStore } from '@/store/UiStore'

import BaseButton from '@/components/ui/BaseButton.vue'

const router = useRouter()
const ui = useUiStore()

const CreateLobby = () => {
    router.push('lobby')
}

const JoinLobby = () => {
    router.push('join')
}


const openGithubRepository = () => {

    window.open('https://github.com/chielre/card-madness/', '_blank', 'noopener,noreferrer')
}
const openLicense = () => {

    window.open('https://github.com/chielre/card-madness/blob/main/LICENSE', '_blank', 'noopener,noreferrer')
}
</script>


<template>
    <div class="page-main min-h-screen flex justify-center items-center">
        <div class="bg-noise"></div>
        <div class="bg-grid"></div>
        <div>
            <!-- Topbar -->
            <img class="logo" width="300" src="../assets/images/logo.png" alt="">
            <div class="mt-16 flex flex-col gap-4">
                <BaseButton @click="CreateLobby" size="lg">Create a lobby</BaseButton>
                <BaseButton @click="JoinLobby" size="lg">Join lobby</BaseButton>
            </div>

            <div class="flex justify-between items-center mt-8">
                <div class="flex justify-between items-center gap-3">
                    <BaseButton @click="openGithubRepository()" icon="Github" color="pink" size="md"></BaseButton>
                    <BaseButton @click="openLicense()" icon="ScaleBalance" color="pink" size="md"></BaseButton>
                </div>
                <div class="flex justify-between items-center gap-3">
                    <BaseButton icon="Cog" color="pink" size="md" @click="ui.openSettings"></BaseButton>
                </div>

            </div>
        </div>
    </div>

</template>
