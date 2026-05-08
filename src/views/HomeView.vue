<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { usePaletteSearchStore } from '@/stores/paletteSearch'

type Palette = {
  id: string
  name: string
  left: string
  right: string
  group: string
}

type PaletteGroup = {
  id: string
  name: string
  palettes: Palette[]
}

type RawPaletteItem = {
  name?: string
  color?: string[]
}

type RawPaletteGroup = {
  class?: string
  data?: Record<string, RawPaletteItem>
}

type RawPaletteFile = Record<string, RawPaletteGroup>

const selectedPalette = ref<Palette | null>(null)
const paletteGroups = ref<PaletteGroup[]>([])
const classGroupOrder = ref<string[]>([])
const classFiltersRef = ref<HTMLElement | null>(null)
const dataReady = ref(false)
const activeClass = ref('全部')
const showFloatingFilters = ref(false)
const searchStore = usePaletteSearchStore()
const snackbar = reactive({
  visible: false,
  text: '',
})
const previewText = ref('')
let classFiltersObserver: IntersectionObserver | null = null

const filteredGroups = computed(() => {
  const keyword = searchStore.normalizedKeyword
  if (!keyword) return paletteGroups.value

  return paletteGroups.value
    .map((group) => {
      const matchedPalettes = group.palettes.filter((palette) => {
        const combined = `${group.name} ${palette.name} ${palette.left} ${palette.right} ${palette.id}`.toLowerCase()
        return combined.includes(keyword)
      })
      return {
        ...group,
        palettes: matchedPalettes,
      }
    })
    .filter((group) => group.palettes.length > 0)
})

const classOptions = computed(() => ['全部', ...classGroupOrder.value])
const groupsTransitionKey = computed(
  () => `${activeClass.value}::${searchStore.normalizedKeyword}::${visibleGroups.value.length}`,
)

const visibleGroups = computed(() => {
  if (activeClass.value === '全部') return filteredGroups.value
  return filteredGroups.value.filter((group) => group.name === activeClass.value)
})

const dialogVisible = computed({
  get: () => selectedPalette.value !== null,
  set: (value: boolean) => {
    if (!value && selectedPalette.value) {
      closePalette()
    }
  },
})

function openPalette(palette: Palette) {
  selectedPalette.value = palette
  previewText.value = ''
}

function closePalette() {
  selectedPalette.value = null
}

watch(selectedPalette, (palette) => {
  if (!palette) return
  previewText.value = ''
})

function cardStyle(palette: Palette) {
  return {
    '--left-color': palette.left,
    '--right-color': palette.right,
  }
}

function dialogStyle(palette: Palette) {
  return {
    '--left-color': palette.left,
    '--right-color': palette.right,
  }
}

async function copyValue(label: string, value: string) {
  try {
    await copyText(value)
    snackbar.text = `已复制 ${label}: ${value}`
  } catch {
    snackbar.text = `复制失败：${label}`
  }
  snackbar.visible = true
}

async function copyText(text: string) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('copy command failed')
  }
}

const dialogLeftText = computed(() => {
  if (!selectedPalette.value) return ''
  return previewText.value || selectedPalette.value.left
})

const dialogRightText = computed(() => {
  if (!selectedPalette.value) return ''
  return previewText.value || selectedPalette.value.right
})

function hexToRgbString(hex: string) {
  const value = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return 'RGB(?, ?, ?)'
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `RGB(${r}, ${g}, ${b})`
}

function shuffleArray<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = shuffled[i] as T
    shuffled[i] = shuffled[j] as T
    shuffled[j] = temp
  }
  return shuffled
}

function setupClassFiltersObserver() {
  if (!classFiltersRef.value || typeof IntersectionObserver === 'undefined') return
  classFiltersObserver = new IntersectionObserver(
    ([entry]) => {
      if (!entry) return
      showFloatingFilters.value = !entry.isIntersecting && entry.boundingClientRect.top < 0
    },
    {
      threshold: 0,
      rootMargin: '0px',
    },
  )
  classFiltersObserver.observe(classFiltersRef.value)
}

function syncFloatingFiltersByPosition() {
  const target = classFiltersRef.value
  if (!target) return
  const { bottom } = target.getBoundingClientRect()
  showFloatingFilters.value = bottom <= 0
}

function teardownClassFiltersObserver() {
  classFiltersObserver?.disconnect()
  classFiltersObserver = null
  window.removeEventListener('scroll', syncFloatingFiltersByPosition)
}

function normalizePaletteData(raw: RawPaletteFile): PaletteGroup[] {
  return Object.entries(raw).map(([groupId, groupRaw]) => {
    const groupName = groupRaw.class ?? `分组 ${groupId}`
    const entries = Object.entries(groupRaw.data ?? {})
    const palettes = entries
      .map(([itemId, item]) => {
        const left = item.color?.[0]
        const right = item.color?.[1]
        if (!left || !right || !item.name) return null

        return {
          id: `${groupId}-${itemId}`,
          name: item.name,
          left,
          right,
          group: groupName,
        } satisfies Palette
      })
      .filter((item): item is Palette => item !== null)

    return {
      id: groupId,
      name: groupName,
      palettes,
    }
  })
}

async function loadPaletteData() {
  try {
    const response = await fetch('/data.json', { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const raw = (await response.json()) as RawPaletteFile
    const groups = normalizePaletteData(raw)
    classGroupOrder.value = groups.map((group) => group.name)
    paletteGroups.value = shuffleArray(groups)
  } catch {
    paletteGroups.value = []
    classGroupOrder.value = []
    snackbar.text = '读取 data.json 失败'
    snackbar.visible = true
  } finally {
    dataReady.value = true
  }
}

onMounted(() => {
  void nextTick(() => {
    setupClassFiltersObserver()
    syncFloatingFiltersByPosition()
    window.addEventListener('scroll', syncFloatingFiltersByPosition, { passive: true })
  })
  void loadPaletteData()
})

onBeforeUnmount(() => {
  teardownClassFiltersObserver()
})

</script>

<template>
  <section class="home">
    <div ref="classFiltersRef" class="class-filters">
      <v-btn
        v-for="className in classOptions"
        :key="className"
        rounded="pill"
        size="small"
        :variant="activeClass === className ? 'flat' : 'text'"
        :class="activeClass === className ? 'class-btn class-btn-active' : 'class-btn'"
        @click="activeClass = className"
      >
        {{ className }}
      </v-btn>
    </div>
    <transition name="floating-filters-fade">
      <aside v-if="showFloatingFilters" class="floating-filters" aria-label="快速筛选分组">
        <transition-group name="filter-chip" tag="div" class="floating-filters-list" appear>
          <v-btn
            v-for="(className, index) in classOptions"
            :key="`floating-${className}`"
            rounded="pill"
            size="small"
            :variant="activeClass === className ? 'flat' : 'text'"
            :class="activeClass === className ? 'floating-class-btn floating-class-btn-active' : 'floating-class-btn'"
            :style="{ '--stagger-index': index }"
            @click="activeClass = className"
          >
            {{ className }}
          </v-btn>
        </transition-group>
      </aside>
    </transition>

    <transition name="group-switch" mode="out-in">
      <div :key="groupsTransitionKey" class="groups-stage">
        <section v-for="group in visibleGroups" :key="group.id" class="palette-group">
          <h2 class="group-title">{{ group.name }}</h2>
          <div class="palette-grid">
            <v-card
              v-for="palette in group.palettes"
              :key="palette.id"
              class="palette-card"
              elevation="2"
              rounded="xl"
              @click="openPalette(palette)"
            >
              <div class="palette-preview" :style="cardStyle(palette)">
                <div class="palette-side left-side">
                  <span class="color-label">{{ palette.left }}</span>
                </div>
                <div class="palette-side right-side">
                  <span class="color-label">{{ palette.right }}</span>
                </div>
              </div>
              <div class="palette-meta">
                <span>{{ palette.name }}</span>
                <v-icon size="18" icon="mdi-arrow-top-right" />
              </div>
            </v-card>
          </div>
        </section>
      </div>
    </transition>
    <v-alert
      v-if="dataReady && visibleGroups.length === 0"
      class="empty-state"
      type="info"
      variant="tonal"
      rounded="lg"
      text="没有匹配的配色卡片，请尝试其他关键词。"
    />

    <v-dialog v-model="dialogVisible" max-width="760" :scrim="'rgba(73, 45, 34, 0.24)'">
      <v-card v-if="selectedPalette" class="dialog-card" rounded="xl">
        <v-btn
          icon="mdi-close"
          variant="text"
          class="close-button"
          aria-label="关闭弹窗"
          @click="closePalette"
        />

        <v-card-title class="dialog-title">{{ selectedPalette.name }}</v-card-title>
        <v-card-text>
          <div class="palette-preview dialog-preview" :style="dialogStyle(selectedPalette)">
            <div class="palette-side left-side">
              <span class="color-label">{{ dialogLeftText }}</span>
            </div>
            <div class="palette-side right-side">
              <span class="color-label">{{ dialogRightText }}</span>
            </div>
          </div>
          <div class="preview-inputs">
            <v-text-field
              v-model="previewText"
              label="输入文字预览效果"
              density="compact"
              variant="outlined"
              hide-details
            />
          </div>
          <p class="copy-tip">点击下方色值复制</p>
          <div class="copy-groups">
            <div class="copy-group">
              <p class="copy-group-title">左侧颜色</p>
              <div class="copy-actions">
                <v-btn
                  color="primary"
                  variant="tonal"
                  rounded="pill"
                  @click="copyValue('左侧 HEX', selectedPalette.left)"
                >
                  HEX {{ selectedPalette.left }}
                </v-btn>
                <v-btn
                  color="primary"
                  variant="outlined"
                  rounded="pill"
                  @click="copyValue('左侧 RGB', hexToRgbString(selectedPalette.left))"
                >
                  RGB {{ hexToRgbString(selectedPalette.left) }}
                </v-btn>
              </div>
            </div>
            <div class="copy-group">
              <p class="copy-group-title">右侧颜色</p>
              <div class="copy-actions">
                <v-btn
                  color="secondary"
                  variant="tonal"
                  rounded="pill"
                  @click="copyValue('右侧 HEX', selectedPalette.right)"
                >
                  HEX {{ selectedPalette.right }}
                </v-btn>
                <v-btn
                  color="secondary"
                  variant="outlined"
                  rounded="pill"
                  @click="copyValue('右侧 RGB', hexToRgbString(selectedPalette.right))"
                >
                  RGB {{ hexToRgbString(selectedPalette.right) }}
                </v-btn>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.visible" :timeout="1300" location="bottom">
      {{ snackbar.text }}
    </v-snackbar>
  </section>
</template>

<style scoped>
.home {
  display: grid;
  gap: 20px;
}

.class-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.class-btn {
  color: #492d22;
  min-width: unset;
  padding-inline: 10px;
}

.class-btn-active {
  color: #f7efe7;
  background: #492d22;
}

.groups-stage {
  display: grid;
  gap: 20px;
}

.floating-filters {
  position: fixed;
  top: 102px;
  left: calc(50% + min(620px, calc(50vw - 16px)) + 10px);
  right: auto;
  z-index: 24;
  pointer-events: none;
}

.floating-filters-list {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  pointer-events: auto;
}

.floating-class-btn {
  min-width: 74px;
  color: #492d22;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: inset 0 0 0 1px rgba(73, 45, 34, 0.12);
  backdrop-filter: blur(7px);
}

.floating-class-btn-active {
  color: #f7efe7;
  background: #492d22;
  box-shadow: 0 10px 18px rgba(73, 45, 34, 0.22);
}

.floating-filters-fade-enter-active,
.floating-filters-fade-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.floating-filters-fade-enter-from,
.floating-filters-fade-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

.filter-chip-enter-active {
  transition:
    opacity 0.26s ease,
    transform 0.26s ease;
  transition-delay: calc(var(--stagger-index) * 36ms);
}

.filter-chip-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.group-switch-enter-active,
.group-switch-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
  will-change: opacity, transform;
}

.group-switch-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.group-switch-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.palette-group {
  display: grid;
  gap: 12px;
}

.group-title {
  color: #492d22;
  font-size: 18px;
  font-weight: 700;
}

.palette-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.palette-card {
  cursor: pointer;
  padding: 12px;
  transition: box-shadow 0.22s ease;
}

.palette-card:hover {
  box-shadow: 0 14px 24px rgba(73, 45, 34, 0.2);
}

.palette-preview {
  border-radius: 14px;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 138px;
}

.dialog-preview {
  min-height: 250px;
}

.palette-side {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
}

.left-side {
  background: var(--left-color);
}

.right-side {
  background: var(--right-color);
}

.left-side .color-label {
  color: var(--right-color);
}

.right-side .color-label {
  color: var(--left-color);
}

.color-label {
  font-size: clamp(0.92rem, 2.1vw, 1.12rem);
  letter-spacing: 0.06em;
  font-weight: 600;
}

.palette-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 4px 0;
  color: #492d22;
}

.dialog-card {
  position: relative;
  padding: 10px 8px 14px;
}

.close-button {
  position: absolute;
  right: 10px;
  top: 10px;
  z-index: 1;
}

.dialog-title {
  padding-right: 44px;
}

.copy-tip {
  margin-top: 16px;
  margin-bottom: 10px;
  color: #6e5144;
}

.copy-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.copy-groups {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.copy-group-title {
  margin-bottom: 8px;
  color: #6e5144;
  font-size: 13px;
}

.preview-inputs {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-top: 14px;
}

.empty-state {
  margin-top: 6px;
}

@media (max-width: 1100px) {
  .palette-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .palette-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .dialog-preview {
    min-height: 182px;
  }

  .copy-groups {
    grid-template-columns: 1fr;
  }

  .floating-filters {
    display: none;
  }

}

</style>
