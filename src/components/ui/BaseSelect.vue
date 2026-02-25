<script setup lang="ts">
import { computed } from "vue"

type SelectValue = string | number

type SelectOption = {
  value: SelectValue
  label: string
}

const props = withDefaults(
  defineProps<{
    modelValue: SelectValue
    options: SelectOption[]
    disabled?: boolean
    name?: string
  }>(),
  {
    disabled: false,
    name: "select",
  }
)

const emit = defineEmits<{
  (e: "update:modelValue", value: SelectValue): void
}>()

const optionMap = computed(() => {
  return new Map(props.options.map((option) => [String(option.value), option.value]))
})

const value = computed<string>({
  get: () => String(props.modelValue ?? ""),
  set: (next) => {
    if (props.disabled) return
    emit("update:modelValue", optionMap.value.get(next) ?? next)
  },
})
</script>

<template>
  <div class="relative w-full">
    <select
      v-model="value"
      :name="name"
      :disabled="disabled"
      class="w-full appearance-none bg-white border-3 border-b-6 border-black rounded-xl px-4 py-3 pr-12 text-lg font-black text-black leading-tight outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option
        v-for="option in options"
        :key="String(option.value)"
        :value="String(option.value)"
      >
        {{ option.label }}
      </option>
    </select>
    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-black">
      <svg viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5">
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.118l3.71-3.887a.75.75 0 1 1 1.08 1.04l-4.25 4.453a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
          clip-rule="evenodd"
        />
      </svg>
    </div>
  </div>
</template>
