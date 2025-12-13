<script setup lang="ts">
import { ref, provide, computed } from "vue";

type TabDef = {
    name: string;
    label: string;
};

const tabs = ref<TabDef[]>([]);
const active = ref<string | null>(null);

const registerTab = (tab: TabDef) => {
    if (!tabs.value.find(t => t.name === tab.name)) {
        tabs.value.push(tab);
        if (!active.value) active.value = tab.name;
    }
};

provide("tabs", {
    registerTab,
    active,
});

const setActive = (name: string) => {
    active.value = name;
};
</script>

<template>
    <div class="col-span-2 space-y-8 max-h-full">
        <!-- Header -->
        <div class="bg-gray-200 rounded-xl p-1 gap-2 grid grid-cols-2">
            <button v-for="tab in tabs" :key="tab.name" class="px-6 py-2 border-2 border-b-4 font-black rounded-lg text-center " :class="active === tab.name
                ? 'bg-white border-gray-500 text-gray-500 cursor-not-allowed'
                : 'border-transparent text-gray-400 hover:bg-gray-300 cursor-pointer'
                " @click="setActive(tab.name)">
                {{ tab.label }}
            </button>
        </div>

        <!-- Content -->
        <slot />
    </div>
</template>
