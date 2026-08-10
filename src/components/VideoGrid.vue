<template>
  <div v-if="videos.length" class="video-grid" :class="`grid-${count}`">
    <div
      v-for="(src, index) in videos"
      :key="index"
      class="video-item"
      :style="itemStyle(index)"
      @click="openFullscreen(index)"
    >
      <!-- preload="metadata" 让浏览器取首帧作封面，无需后端 ffmpeg -->
      <video
        :ref="(el) => (videoRefs[index] = el)"
        :src="src"
        preload="metadata"
        playsinline
        webkit-playsinline
        muted
        class="video-thumb"
        @loadeddata="onLoaded(index)"
      />
      <!-- 封面未加载时的占位 -->
      <div v-if="!loaded[index]" class="video-placeholder">
        <van-icon name="video-o" size="32" color="#c8c9cc" />
      </div>
      <!-- 播放按钮遮罩 -->
      <div class="play-mask">
        <van-icon name="play-circle-o" size="40" color="#fff" />
      </div>
    </div>
  </div>

  <!-- 全屏播放弹层 -->
  <van-popup
    v-model:show="fullscreenShow"
    position="center"
    :style="{ width: '100%', height: '100%', background: '#000' }"
    :close-on-click-overlay="true"
    @closed="stopFullscreen"
  >
    <div class="fullscreen-wrap">
      <video
        v-if="fullscreenSrc"
        ref="fullscreenVideoRef"
        :src="fullscreenSrc"
        controls
        autoplay
        playsinline
        webkit-playsinline
        class="fullscreen-video"
      />
      <van-icon
        name="cross"
        size="24"
        color="#fff"
        class="close-btn"
        @click="fullscreenShow = false"
      />
    </div>
  </van-popup>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  videos: { type: Array, default: () => [] }
})

const count = computed(() => Math.min(props.videos.length, 9))
const loaded = ref({})
const videoRefs = ref({})
const fullscreenShow = ref(false)
const fullscreenSrc = ref('')
const fullscreenVideoRef = ref(null)

function itemStyle(_index) {
  // 单视频时宽屏展示，多视频时方形网格
  if (props.videos.length === 1) {
    return { width: '100%', maxWidth: '360px' }
  }
  return {}
}

function onLoaded(index) {
  loaded.value[index] = true
}

function openFullscreen(index) {
  fullscreenSrc.value = props.videos[index]
  fullscreenShow.value = true
}

function stopFullscreen() {
  fullscreenSrc.value = ''
}
</script>

<style scoped>
.video-grid {
  display: grid;
  gap: 3px;
  width: 100%;
}

.video-grid.grid-1 {
  grid-template-columns: 1fr;
}

.video-grid:not(.grid-1) {
  grid-template-columns: repeat(3, 1fr);
}

.video-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 4px;
  background: #000;
  cursor: pointer;
}

.video-grid.grid-1 .video-item {
  aspect-ratio: 16 / 9;
  max-width: 360px;
}

.video-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f7f8fa;
}

.play-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
}

.play-mask :deep(.van-icon) {
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
}

.fullscreen-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fullscreen-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  padding: 4px;
  cursor: pointer;
}
</style>
