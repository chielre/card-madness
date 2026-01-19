<script setup lang="ts">
import { useLobbyStore } from '@/store/LobbyStore'
import BaseButton from '@/components/ui/BaseButton.vue'

const props = defineProps<{
    lobbyId: string
    nameInput: string
    errorMessage: string
    players: { id: string; name: string }[]
}>()

const emit = defineEmits<{ join: []; 'update:nameInput': [value: string] }>()

const lobby = useLobbyStore()
</script>

<template>
    <div>
        <img class="logo m-auto" width="300" src="../../../assets/images/logo.png" alt="">

        <div class="mt-4 bg-white border-4 border-b-8 rounded-xl border-black p-8 text-black">

            <div class="text-black space-y-3">
                <input :value="nameInput" @input="emit('update:nameInput', ($event.target as HTMLInputElement).value)" type="text" class="border-4 text-xl font-black border-black rounded-xl px-4 py-2 w-full" placeholder="Your name" />



                <p v-if="errorMessage" class="text-red-600">{{ errorMessage }}</p>
            </div>

        </div>
        <div class="flex ">
            <BaseButton @click="emit('join')" class="mt-4 flex-1" size="md">Join game</BaseButton>
        </div>
    </div>
</template>
