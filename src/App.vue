<template>
  <v-app>
    <v-app-bar class="ushio-app-bar" height="72" flat>
      <template #prepend>
        <div class="nav-left">
          <span class="title-font nav-title">ushio调色板</span>
          <v-btn to="/" variant="text" rounded="pill" class="home-btn" prepend-icon="mdi-home-outline">
            首页
          </v-btn>
          <v-btn
            to="/palette"
            rounded="xl"
            density="compact"
            :variant="isActive('/palette') ? 'flat' : 'text'"
            :class="isActive('/palette') ? 'nav-btn nav-btn-active' : 'nav-btn'"
          >
            <Palette :size="16" :stroke-width="2.2" class="mr-2 nav-lucide" />
            调色板
          </v-btn>
          <v-btn
            to="/about"
            rounded="xl"
            density="compact"
            :variant="isActive('/about') ? 'flat' : 'text'"
            :class="isActive('/about') ? 'nav-btn nav-btn-active' : 'nav-btn'"
          >
          <v-icon icon="mdi-information-outline" size="18" class="mr-2" />
          关于
        </v-btn>
        </div>
      </template>
      <v-spacer />

      <v-toolbar-items class="nav-items">
        <v-btn
          icon="mdi-magnify"
          variant="text"
          density="compact"
          class="nav-search-trigger"
          @click="toggleSearch"
        />
        <v-expand-x-transition>
          <div v-if="isSearchOpen" ref="searchWrapRef" class="nav-search-wrap">
            <v-text-field
              v-model="searchStore.keyword"
              class="nav-search"
              density="compact"
              variant="solo-filled"
              rounded="xl"
              hide-details
              clearable
              autofocus
              prepend-inner-icon="mdi-magnify"
              placeholder="搜索配色名称或色值"
              @update:model-value="onSearchInput"
              @blur="onSearchBlur"
            />
          </div>
        </v-expand-x-transition>
      </v-toolbar-items>
    </v-app-bar>

    <v-main>
      <v-container class="main-container">
        <RouterView />
      </v-container>
    </v-main>

    <v-footer class="site-footer" app height="44">
      <div class="footer-inner">
        <Heart class="footer-heart" :size="14" :stroke-width="2.2" />
        Made By
        <a
          href="https://ueg.ee"
          target="_blank"
        >
          UEGEE
        </a>
        <br/>
      </div>
    </v-footer>
  </v-app>
</template>

<script setup lang="ts">
import { Heart, Palette } from '@lucide/vue'
import { nextTick, ref } from 'vue'
import { RouterView } from 'vue-router'
import { useRoute } from 'vue-router'
import { useRouter } from 'vue-router'
import { usePaletteSearchStore } from './stores/paletteSearch'

const route = useRoute()
const router = useRouter()
const searchStore = usePaletteSearchStore()
const isSearchOpen = ref(false)
const searchWrapRef = ref<HTMLElement | null>(null)

function isActive(path: string) {
  return route.path === path
}

function onSearchInput() {
  if (route.path !== '/') {
    router.push('/')
  }
}

function toggleSearch() {
  if (!isSearchOpen.value) {
    isSearchOpen.value = true
    nextTick(() => {
      const input = searchWrapRef.value?.querySelector('input')
      input?.focus()
    })
    return
  }

  if (!(searchStore.keyword ?? '').trim()) {
    isSearchOpen.value = false
  }
}

function onSearchBlur() {
  if (!(searchStore.keyword ?? '').trim()) {
    isSearchOpen.value = false
  }
}
</script>

<style scoped>
.ushio-app-bar {
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.98), rgba(216, 199, 181, 0.72)) !important;
  box-shadow: 0 8px 24px rgba(73, 45, 34, 0.12);
  backdrop-filter: blur(10px);
}

.ushio-app-bar :deep(.v-toolbar__content) {
  max-width: 1240px;
  margin: 0 auto;
  padding-inline: 16px;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.home-btn {
  color: #492d22;
  min-width: unset;
  height: 30px;
  padding-inline: 10px;
}

.nav-title {
  color: #492d22;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.title-font {
  letter-spacing: 0.04em;
}

.nav-items {
  gap: 8px;
  align-items: center;
}

.nav-search-wrap {
  display: flex;
  align-items: center;
}

.nav-search-trigger {
  color: #492d22;
}

.nav-search {
  width: min(42vw, 340px);
}

.nav-search :deep(.v-field) {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.68);
  box-shadow: inset 0 0 0 1px rgba(73, 45, 34, 0.14);
}

.nav-search :deep(.v-field__input) {
  min-height: 36px;
  padding-top: 0;
  padding-bottom: 0;
}

.nav-btn {
  color: #492d22;
  min-width: unset;
  height: 28px !important;
  min-height: 28px !important;
  padding-inline: 10px;
  background: transparent;
}

.nav-btn-active {
  color: #f7efe7;
  background: #492d22;
}

.nav-lucide {
  display: inline-block;
  vertical-align: middle;
}

@media (max-width: 720px) {
  .nav-search {
    width: min(54vw, 260px);
  }
}

.main-container {
  max-width: 1240px;
  padding-top: 32px;
  padding-bottom: 48px;
}

.site-footer {
  background: transparent;
  color: #6e5144;
}

.footer-inner {
  width: 100%;
  text-align: center;
  font-size: 13px;
}

.footer-link {
  margin-left: 4px;
}

.footer-heart {
  display: inline-block;
  vertical-align: text-bottom;
  margin-left: 4px;
  color: #492d22;
}
</style>
