<template>
  <div class="like-button" @click="handleClick">
    <van-icon
      :name="liked ? 'like' : 'like-o'"
      :color="liked ? '#ee0a24' : '#333'"
      size="20"
      :class="{ 'like-animate': animating }"
    />
    <span class="like-text" :class="{ active: liked }">{{ label }}</span>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { showToast } from 'vant'
import { toggleLike } from '@/api/post'

const props = defineProps({
  postId: { type: Number, required: true },
  liked: { type: Boolean, default: false },
  count: { type: Number, default: 0 }
})

const emit = defineEmits(['update:liked', 'update:count'])

const label = computed(() => props.count > 0 ? `${props.count}` : '赞')
const animating = ref(false)

async function handleClick() {
  try {
    const res = await toggleLike(props.postId)
    emit('update:liked', res.liked)
    emit('update:count', props.count + (res.liked ? 1 : -1))
    if (res.liked) {
      animating.value = true
      setTimeout(() => { animating.value = false }, 400)
    }
  } catch (e) {
    showToast({ type: 'fail', message: '操作失败' })
  }
}
</script>

<style scoped>
.like-button {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  user-select: none;
}

.like-text {
  font-size: 13px;
  color: #666;
}

.like-text.active {
  color: #ee0a24;
}

.like-animate {
  animation: like-bounce 0.4s ease;
}

@keyframes like-bounce {
  0% { transform: scale(1); }
  30% { transform: scale(1.35); }
  60% { transform: scale(0.9); }
  100% { transform: scale(1); }
}
</style>
