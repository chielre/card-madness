<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import { useRouter } from 'vue-router'
import { useLobbyStore } from '@/store/LobbyStore'

const lobby = useLobbyStore()
const router = useRouter();
const createGame = async () => {

    await lobby.createLobby('Chiel');

    router.push({ name: 'game', params: { id: lobby.lobbyId } })
}

</script>


<template>
    <div class="page-main min-h-screen flex justify-center items-center">
        <div class="bg-noise"></div>
        <div class="bg-grid"></div>


      


        <div class=" min-w-1/2">
            <div class="bg-white border-4 border-b-8 rounded-xl border-black p-8">
                <BaseButton @click="createGame" size="lg">Create game</BaseButton>


            </div>

        </div>

    </div>

</template>
