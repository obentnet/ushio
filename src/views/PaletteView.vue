<script setup lang="ts">
import { ArrowLeftRight, Copy, Trash2 as Trash } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'

type RawPaletteItem = {
  color?: string[]
}

type RawPaletteGroup = {
  data?: Record<string, RawPaletteItem>
}

type RawPaletteFile = Record<string, RawPaletteGroup>

type CustomPaletteCard = {
  id: number
  name: string
  left: string
  right: string
}

type RingSegment = {
  color: string
  start: number
  end: number
  mid: number
  path: string
}

type LabColor = {
  l: number
  a: number
  b: number
}

const allHexColors = ref<string[]>([])
const selectedHexHistory = ref<string[]>([])
const pendingPair = ref<string[]>([])
const customCards = ref<CustomPaletteCard[]>([])
const hoveredSegment = ref<number | null>(null)
const dataReady = ref(false)
const nextCardId = ref(1)
const snackbarVisible = ref(false)
const snackbarText = ref('')

const ringOuterRadius = 292
const ringInnerRadius = 122
const ringCenter = 360
const hoverOffset = 16
const selectedOffset = 9

const ringSegments = computed<RingSegment[]>(() => {
  const colors = allHexColors.value
  if (colors.length === 0) return []
  const angleStep = (Math.PI * 2) / colors.length
  const startAngle = -Math.PI / 2

  return colors.map((color, index) => {
    const start = startAngle + index * angleStep
    const end = start + angleStep
    const mid = start + angleStep / 2
    return {
      color,
      start,
      end,
      mid,
      path: buildRingSegmentPath(start, end, ringOuterRadius, ringInnerRadius, ringCenter, ringCenter),
    }
  })
})

const pendingStatus = computed(() => {
  if (pendingPair.value.length === 0) return '点击任意颜色开始配对'
  return `已选第 1 个颜色：${pendingPair.value[0]}，再点击一个颜色生成卡片`
})

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  }
}

function buildRingSegmentPath(
  startAngle: number,
  endAngle: number,
  outerRadius: number,
  innerRadius: number,
  cx: number,
  cy: number,
) {
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle)
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle)
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle)
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle)

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

function normalizeHex(value: string) {
  const trimmed = value.trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) return null
  return trimmed.toUpperCase()
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  const value = normalized.slice(1)
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return { r, g, b }
}

function srgbToLinear(channel: number) {
  const c = channel / 255
  if (c <= 0.04045) return c / 12.92
  return ((c + 0.055) / 1.055) ** 2.4
}

function rgbToLab(r: number, g: number, b: number): LabColor {
  const rl = srgbToLinear(r)
  const gl = srgbToLinear(g)
  const bl = srgbToLinear(b)

  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175
  const z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041

  const xn = 0.95047
  const yn = 1
  const zn = 1.08883

  const fx = xyzPivot(x / xn)
  const fy = xyzPivot(y / yn)
  const fz = xyzPivot(z / zn)

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

function xyzPivot(value: number) {
  const delta = 6 / 29
  const cubic = value ** (1 / 3)
  if (value > delta ** 3) return cubic
  return value / (3 * delta ** 2) + 4 / 29
}

function colorDistanceLab(c1: LabColor, c2: LabColor) {
  const dl = c1.l - c2.l
  const da = c1.a - c2.a
  const db = c1.b - c2.b
  return Math.sqrt(dl * dl + da * da + db * db)
}

function orderColorsForSmoothGradient(colors: string[]) {
  if (colors.length <= 3) return [...colors]

  const labColors = colors.map((hex) => {
    const rgb = hexToRgb(hex)
    if (!rgb) {
      return { l: 0, a: 0, b: 0 }
    }
    return rgbToLab(rgb.r, rgb.g, rgb.b)
  })

  const distance = Array.from({ length: colors.length }, () => Array<number>(colors.length).fill(0))
  for (let i = 0; i < colors.length; i += 1) {
    for (let j = i + 1; j < colors.length; j += 1) {
      const d = colorDistanceLab(labColors[i] as LabColor, labColors[j] as LabColor)
      distance[i]![j] = d
      distance[j]![i] = d
    }
  }

  const indexSet = new Set<number>(Array.from({ length: colors.length }, (_, i) => i))
  const first = 0
  indexSet.delete(first)

  let second = first
  let farthest = -1
  for (const idx of indexSet) {
    const d = distance[first]?.[idx] ?? 0
    if (d > farthest) {
      farthest = d
      second = idx
    }
  }
  indexSet.delete(second)

  let third = second
  let maxSpread = -1
  for (const idx of indexSet) {
    const d = Math.min(distance[idx]?.[first] ?? 0, distance[idx]?.[second] ?? 0)
    if (d > maxSpread) {
      maxSpread = d
      third = idx
    }
  }
  indexSet.delete(third)

  const cycle = [first, second, third]

  while (indexSet.size > 0) {
    let bestNode = -1
    let bestPos = -1
    let bestIncrease = Number.POSITIVE_INFINITY

    for (const node of indexSet) {
      for (let i = 0; i < cycle.length; i += 1) {
        const current = cycle[i] as number
        const next = cycle[(i + 1) % cycle.length] as number
        const increase =
          (distance[current]?.[node] ?? 0) + (distance[node]?.[next] ?? 0) - (distance[current]?.[next] ?? 0)
        if (increase < bestIncrease) {
          bestIncrease = increase
          bestNode = node
          bestPos = i
        }
      }
    }

    if (bestNode < 0 || bestPos < 0) break
    cycle.splice(bestPos + 1, 0, bestNode)
    indexSet.delete(bestNode)
  }

  return cycle.map((idx) => colors[idx] as string)
}

function collectHexColors(raw: RawPaletteFile) {
  const unique = new Set<string>()

  for (const group of Object.values(raw)) {
    const entries = Object.values(group.data ?? {})
    for (const item of entries) {
      for (const rawColor of item.color ?? []) {
        const color = normalizeHex(rawColor)
        if (color) unique.add(color)
      }
    }
  }

  return orderColorsForSmoothGradient([...unique])
}

function segmentOffsetStyle(index: number, angle: number) {
  let distance = 0
  if (hoveredSegment.value === index) {
    distance = hoverOffset
  } else if (pendingPair.value.includes(ringSegments.value[index]?.color ?? '')) {
    distance = selectedOffset
  }

  const dx = Math.cos(angle) * distance
  const dy = Math.sin(angle) * distance

  return {
    transform: `translate(${dx}px, ${dy}px)`,
  }
}

function selectColor(hex: string) {
  selectedHexHistory.value = [hex, ...selectedHexHistory.value].slice(0, 24)
  pendingPair.value = [...pendingPair.value, hex]

  if (pendingPair.value.length < 2) return

  const left = pendingPair.value[0] ?? hex
  const right = pendingPair.value[1] ?? hex
  const cardId = nextCardId.value

  customCards.value = [
    {
      id: cardId,
      name: `自调#${cardId}`,
      left,
      right,
    },
    ...customCards.value,
  ]

  nextCardId.value += 1
  pendingPair.value = []
}

function swapCardColors(cardId: number) {
  customCards.value = customCards.value.map((card) => {
    if (card.id !== cardId) return card
    return {
      ...card,
      left: card.right,
      right: card.left,
    }
  })
}

function clearSelections() {
  pendingPair.value = []
  selectedHexHistory.value = []
  customCards.value = []
}

async function copyColor(label: string, value: string) {
  try {
    await copyText(value)
    snackbarText.value = `已复制 ${label}: ${value}`
  } catch {
    snackbarText.value = `复制失败：${label}`
  }
  snackbarVisible.value = true
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

async function loadHexData() {
  try {
    const response = await fetch('/data.json', { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const raw = (await response.json()) as RawPaletteFile
    allHexColors.value = collectHexColors(raw)
  } catch {
    allHexColors.value = []
  } finally {
    dataReady.value = true
  }
}

onMounted(() => {
  void loadHexData()
})
</script>

<template>
  <section class="palette-page">
    <div class="layout-grid">
      <v-card rounded="xl" elevation="1" class="wheel-card">
        <v-card-title class="panel-title">USHIO 调色板</v-card-title>
        <v-card-text class="wheel-content">
          <svg
            v-if="ringSegments.length > 0"
            class="palette-wheel"
            viewBox="0 0 720 720"
            role="img"
            aria-label="圆形调色板"
          >
            <g v-for="(segment, index) in ringSegments" :key="segment.color" :style="segmentOffsetStyle(index, segment.mid)">
              <path
                class="wheel-segment"
                :class="{ 'segment-active': pendingPair.includes(segment.color) }"
                :d="segment.path"
                :fill="segment.color"
                @mouseenter="hoveredSegment = index"
                @mouseleave="hoveredSegment = null"
                @click="selectColor(segment.color)"
              />
            </g>
            <circle :cx="ringCenter" :cy="ringCenter" r="96" fill="rgba(255, 255, 255, 0.82)" />
            <text :x="ringCenter" :y="ringCenter - 8" text-anchor="middle" class="wheel-center-title">HEX</text>
            <text :x="ringCenter" :y="ringCenter + 22" text-anchor="middle" class="wheel-center-subtitle">{{ ringSegments.length }} 色</text>
          </svg>
          <v-alert
            v-else-if="dataReady"
            type="warning"
            variant="tonal"
            rounded="lg"
            text="未读取到可用 HEX 数据"
          />
          <v-skeleton-loader v-else type="image" class="wheel-loading" />
        </v-card-text>
      </v-card>

      <v-card rounded="xl" elevation="1" class="result-card">
        <v-card-title class="panel-title">已选择颜色</v-card-title>
        <v-card-text class="result-content">
          <p class="pending-line">{{ pendingStatus }}</p>

          <div class="selected-history">
            <span v-for="(color, index) in selectedHexHistory" :key="`${color}-${index}`" class="history-chip">
              <span class="chip-dot" :style="{ background: color }" />
              {{ color }}
            </span>
          </div>

          <div class="custom-cards">
            <article v-for="card in customCards" :key="card.id" class="custom-card">
              <div class="custom-preview">
                <div class="preview-side left" :style="{ background: card.left, color: card.right }">
                  {{ card.left }}
                </div>
                <button
                  type="button"
                  class="swap-btn"
                  :aria-label="`交换 ${card.name} 颜色`"
                  @click="swapCardColors(card.id)"
                >
                  <ArrowLeftRight :size="16" :stroke-width="2.3" />
                </button>
                <div class="preview-side right" :style="{ background: card.right, color: card.left }">
                  {{ card.right }}
                </div>
              </div>
              <p class="custom-name">{{ card.name }}</p>
              <div class="copy-actions">
                <button type="button" class="copy-btn" @click="copyColor('左侧 HEX', card.left)">
                  <Copy :size="13" :stroke-width="2.3" />
                  {{ card.left }}
                </button>
                <button type="button" class="copy-btn" @click="copyColor('右侧 HEX', card.right)">
                  <Copy :size="13" :stroke-width="2.3" />
                  {{ card.right }}
                </button>
              </div>
            </article>
            <p v-if="customCards.length === 0" class="empty-tip">每点击两次颜色后会在这里生成自调卡片</p>
          </div>

          <div class="clear-area">
            <button
              type="button"
              class="clear-btn"
              aria-label="清除已选择颜色"
              :disabled="selectedHexHistory.length === 0 && customCards.length === 0 && pendingPair.length === 0"
              @click="clearSelections"
            >
              <Trash :size="14" :stroke-width="2.2" />
              清除
            </button>
          </div>
        </v-card-text>
      </v-card>
    </div>
    <v-snackbar v-model="snackbarVisible" :timeout="1300" location="bottom">
      {{ snackbarText }}
    </v-snackbar>
  </section>
</template>

<style scoped>
.palette-page {
  width: 100%;
}

.layout-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 18px;
  align-items: start;
}

.wheel-card,
.result-card {
  width: 100%;
  padding: 6px 8px;
}

.panel-title {
  color: #492d22;
  font-weight: 700;
}

.wheel-content {
  display: grid;
  place-items: center;
}

.palette-wheel {
  width: min(100%, 740px);
  max-width: 740px;
  height: auto;
}

.palette-wheel g {
  transition: transform 0.16s ease;
}

.wheel-segment {
  cursor: pointer;
  transition:
    transform 0.16s ease,
    filter 0.16s ease;
}

.wheel-segment:hover {
  filter: saturate(1.16) brightness(1.03);
}

.segment-active {
  filter: saturate(1.2) brightness(1.04);
}

.wheel-center-title {
  fill: #492d22;
  font-weight: 700;
  font-size: 28px;
}

.wheel-center-subtitle {
  fill: #6e5144;
  font-size: 14px;
}

.wheel-loading {
  width: min(100%, 620px);
}

.result-content {
  display: grid;
  gap: 14px;
}

.pending-line {
  margin: 0;
  color: #6e5144;
  font-size: 13px;
}

.selected-history {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.history-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  color: #4d3327;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: inset 0 0 0 1px rgba(73, 45, 34, 0.12);
  font-size: 12px;
}

.chip-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.8);
}

.custom-cards {
  display: grid;
  gap: 12px;
}

.custom-card {
  padding: 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.68);
  box-shadow: inset 0 0 0 1px rgba(73, 45, 34, 0.12);
}

.custom-preview {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  border-radius: 12px;
  overflow: hidden;
}

.preview-side {
  min-height: 82px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.swap-btn {
  width: 44px;
  border: 0;
  background: rgba(255, 255, 255, 0.95);
  color: #492d22;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease;
}

.swap-btn:hover {
  background: #fff;
}

.custom-name {
  margin: 8px 0 0;
  color: #492d22;
  font-weight: 700;
}

.copy-actions {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.copy-btn {
  border: 0;
  border-radius: 999px;
  height: 28px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.9);
  color: #5f4437;
  box-shadow: inset 0 0 0 1px rgba(73, 45, 34, 0.14);
  cursor: pointer;
}

.copy-btn:hover {
  background: #fff;
  color: #492d22;
}

.clear-area {
  display: flex;
  justify-content: flex-end;
}

.clear-btn {
  height: 28px;
  border: 0;
  border-radius: 999px;
  padding: 0 10px;
  gap: 5px;
  background: rgba(255, 255, 255, 0.88);
  color: #6e5144;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.16s ease,
    color 0.16s ease;
}

.clear-btn:hover {
  background: #fff;
  color: #492d22;
}

.clear-btn:disabled {
  opacity: 0.44;
  cursor: default;
}

.clear-btn:disabled:hover {
  background: rgba(255, 255, 255, 0.88);
  color: #6e5144;
}

.clear-btn:where(:not(:disabled)) {
  border: 0;
  box-shadow: inset 0 0 0 1px rgba(73, 45, 34, 0.16);
}

.empty-tip {
  margin: 0;
  color: #7a6051;
  font-size: 13px;
}

@media (max-width: 1080px) {
  .layout-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
