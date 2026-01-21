<script setup lang="ts">
import { ref } from 'vue'
import { useLobbyStore } from '@/store/LobbyStore'
import BaseButton from '@/components/ui/BaseButton.vue'

const lobbyCode = ref('')
const errorMessage = ref('')
const lobby = useLobbyStore()

const normalizeLobbyCode = (value: string) => value.replace(/\D/g, '').slice(0, 5)

const onLobbyCodeInput = (event: Event) => {
    lobbyCode.value = normalizeLobbyCode((event.target as HTMLInputElement).value)
    if (errorMessage.value) errorMessage.value = ''
}

async function submitLobbyCode() {
    const code = lobbyCode.value
    if (!code) return
    if (code.length !== 5) {
        errorMessage.value = "Code moet 5 cijfers zijn"
        return
    }

    const exists = await lobby.checkLobbyExists(code)
    if (!exists) {
        errorMessage.value = "Lobby bestaat niet (meer)"
        return
    }

    await lobby.goToGame(code)
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
                    <input :value="lobbyCode" @input="onLobbyCodeInput" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="5" class="border-4 text-xl font-black border-black rounded-xl px-4 py-2 w-full" placeholder="Lobby code" />



                    <p v-if="errorMessage" class="text-red-600">{{ errorMessage }}</p>
                </div>

            </div>
            <div class="flex ">
                <BaseButton @click="submitLobbyCode" class="mt-4 flex-1" size="md">Join game</BaseButton>
            </div>
        </div>
    </div>
</template>
