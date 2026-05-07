
<script setup lang="ts">
import { HandHeart } from '@lucide/vue'

const items = [
  { name: 'obentnet', action: '创建项目', link: 'https://github.com/obentnet/ushio' },
]
</script>

<template>
  <v-card rounded="xl" elevation="1" class="about-card">
    <v-card-title class="about-title">
      <v-icon icon="mdi-information-outline" size="18" class="mr-2" />
      关于本站
    </v-card-title>
    <v-card-text>
      <p>Ushio调色板是一款在线选择撞色的工具，你可以任意复制使用色值；</p>
      <p class="repo-line">
        <v-icon icon="mdi-github" size="18" class="mr-2" />
        开源地址：
        <a
          href="https://github.com/obentnet/ushio"
          target="_blank"
          rel="noopener"
          data-link-text="https://github.com/obentnet/ushio"
        >
          https://github.com/obentnet/ushio
        </a>
      </p>
      <p>如果你有新的颜色想要增加到本站，可以通过<a href="https://github.com/obentnet/ushio/issues"target="_blank" rel="noopener" data-link-text="https://github.com/obentnet/ushio/issues">提交Issuse</a>的方法来增加~</p>
    </v-card-text>
    <v-card-title class="contribute">
      <HandHeart :size="18" :stroke-width="2.2" class="mr-2 contribute-icon" />
      贡献列表
    </v-card-title>
    <v-card-text>
      <v-data-table :items="items" />
    </v-card-text>
  </v-card>
</template>

<style scoped>
.about-card {
  width: 100%;
}

.about-title {
  display: flex;
  align-items: center;
  padding-top: 18px;
}

.repo-line {
  display: flex;
  align-items: center;
  gap: 2px;
}

.contribute {
  display: flex;
  align-items: center;
}

.contribute-icon {
  color: #492d22;
}
</style>
