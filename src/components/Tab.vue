<script setup lang="ts">
import { inject, onMounted, computed } from "vue";

const props = defineProps<{
    name: string;
    label: string;
}>();

const tabs = inject<any>("tabs");

onMounted(() => {
    tabs.registerTab({ name: props.name, label: props.label });
});

const isActive = computed(() => tabs.active.value === props.name);
</script>

<template>
    <div v-show="isActive">
        <slot />
    </div>
</template>
