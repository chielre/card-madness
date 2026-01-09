<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import { useRouter } from 'vue-router'
import { useLobbyStore } from '@/store/LobbyStore'

const lobby = useLobbyStore()
const router = useRouter();


const nameInput = ref('')
const errorMessage = ref('')


const createLobby = async () => {
    if (!nameInput.value.trim()) return
    try {
        await lobby.createLobby(nameInput.value);
        return router.push({ name: 'game', params: { id: lobby.lobbyId } })
    } catch (e) {
        errorMessage.value = e instanceof Error ? e.message : 'Lobby kan niet worden gemaakt'
    }
}

</script>


<template>
    <div class="page-main min-h-screen flex justify-center items-center">
        <div class="bg-noise"></div>
        <div class="bg-grid"></div>

        <div>
            <img class="logo m-auto" width="300" src="../assets/images/logo.png" alt="">

            <div class="mt-4 bg-white border-4 border-b-8 rounded-xl border-black p-8 text-black">
                <div class="text-black space-y-3">
                    <input v-model="nameInput" type="text" class="border-4 text-xl font-black border-black rounded-xl px-4 py-2 w-full" placeholder="Your name" />
                </div>
                <p v-if="errorMessage" class="text-red-600">{{ errorMessage }}</p>
            </div>
            <div class="flex mt-4">
                <BaseButton @click="createLobby" size="lg">Create game</BaseButton>
            </div>
        </div>
    </div>

</template>
