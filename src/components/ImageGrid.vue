<template>
  <div v-if="images.length" class="image-grid" :class="`grid-${count}`">
    <div
      v-for="(img, index) in images"
      :key="index"
      class="image-item"
      @click="handlePreview(index)"
    >
      <van-image
        :src="img"
        :style="itemStyle(index)"
        fit="cover"
        lazy-load
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { showImagePreview } from 'vant'
import 'vant/es/image-preview/style'

const props = defineProps({
  images: { type: Array, default: () => [] }
})

const count = computed(() => Math.min(props.images.length, 9))

function itemStyle(_index) {
  if (props.images.length === 1) {
    return { width: '100%', maxWidth: '280px', height: 'auto', aspectRatio: '1' }
  }
  return {}
}

function handlePreview(index) {
  showImagePreview({
    images: props.images,
    startPosition: index,
    closeable: true
  })
}
</script>

<style scoped>
.image-grid {
  display: grid;
  gap: 3px;
  width: 100%;
}

.image-grid.grid-1 {
  grid-template-columns: 1fr;
}

.image-grid:not(.grid-1) {
  grid-template-columns: repeat(3, 1fr);
}

.image-grid.grid-1 .image-item {
  max-width: 280px;
}

.image-item {
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 4px;
}

.image-grid.grid-1 .image-item {
  aspect-ratio: auto;
}

.image-item :deep(.van-image) {
  width: 100%;
  height: 100%;
}

.image-item :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
