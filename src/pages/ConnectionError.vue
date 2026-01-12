<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import { useConnectionStore } from '@/store/ConnectionStore'

const reconnect = () => {
    let connection = useConnectionStore();
    connection.connect();
}


</script>

<template>
    <div class="flex-1 min-h-screen overflow-hidden">

        <div class="page-main min-h-screen flex justify-center items-center">

            <div class="flex flex-col items-center">
                <!-- Topbar -->
                <img class="m-auto" width="300" src="../assets/images/logo.png" alt="">
                <div class="bg-white text-black border-black rounded-xl border-8 p-8 text-2xl font-bold max-w-1/2 mt-8 text-center">

                    <h1 class="font-bold text-4xl mb-5">Whoops!</h1>

                    We are sorry.. we couldn't connect you to our server. Try reloading the page or try to connect again.
                    
                    
                    <br>
                    <BaseButton @click="reconnect" class="mt-8 block" size="lg">I dont care, try again</BaseButton>

                </div>
            </div>
        </div>
    </div>

</template>