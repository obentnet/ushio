import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export const usePaletteSearchStore = defineStore('paletteSearch', () => {
  const keyword = ref<string | null>('')
  const normalizedKeyword = computed(() => (keyword.value ?? '').trim().toLowerCase())

  return {
    keyword,
    normalizedKeyword,
  }
})
