<script setup lang="ts">
import { computed } from "vue";

type ToggleValue = "on" | "off";

const props = withDefaults(
    defineProps<{
        modelValue: ToggleValue;
        name?: string;
    }>(),
    {
        modelValue: "on",
        name: "toggle",
    }
);

const emit = defineEmits<{
    (e: "update:modelValue", value: ToggleValue): void;
}>();

const value = computed({
    get: () => props.modelValue,
    set: (v: ToggleValue) => emit("update:modelValue", v),
});
</script>

<template>
    <div class="bg-white border-3 border-b-6 rounded-xl border-black grid grid-cols-2 p-1">
        <!-- AAN -->
        <label class="cursor-pointer text-center">
            <input type="radio" :name="name" class="peer hidden" value="on" v-model="value" />
            <div class="peer-checked:bg-gray-300 rounded-lg font-bold font-roboto py-3 px-8  transition-all ease-in-out uppercase">
                AAN
            </div>
        </label>

        <!-- UIT -->
        <label class="cursor-pointer text-center">
            <input type="radio" :name="name" class="peer hidden" value="off" v-model="value" />
            <div class="peer-checked:bg-gray-300 rounded-lg font-bold font-roboto py-3 px-6 transition-all ease-in-out uppercase">
                UIT
            </div>
        </label>
    </div>
</template>
