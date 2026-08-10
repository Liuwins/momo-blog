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
import { getVisitorId } from '@/utils/visitor'
import { useUserStore } from '@/stores/user'

const props = defineProps({
  postId: { type: Number, required: true },
  liked: { type: Boolean, default: false },
  count: { type: Number, default: 0 }
})

const emit = defineEmits(['update:liked', 'update:count'])

const userStore = useUserStore()
const label = computed(() => (props.count > 0 ? `${props.count}` : '赞'))
const animating = ref(false)
const pending = ref(false)

async function handleClick() {
  // 防抖：请求进行中不重复触发
  if (pending.value) return
  pending.value = true

  // 乐观更新：先更新 UI 再发请求，网络慢时也有即时反馈
  const prevLiked = props.liked
  const optimisticLiked = !prevLiked
  const optimisticCount = Math.max(0, props.count + (optimisticLiked ? 1 : -1))
  emit('update:liked', optimisticLiked)
  emit('update:count', optimisticCount)

  if (optimisticLiked) {
    animating.value = true
    setTimeout(() => {
      animating.value = false
    }, 400)
  }

  try {
    const visitorId = userStore.isLoggedIn ? null : getVisitorId()
    const res = await toggleLike(props.postId, visitorId)
    // 用后端返回的真实状态校正
    if (!res.liked && !prevLiked) {
      // 未生效（如未登录无 visitorId 的兜底），回滚
      emit('update:liked', prevLiked)
      emit('update:count', props.count)
      showToast({ type: 'fail', message: '操作失败' })
      return
    }
    emit('update:liked', res.liked)
    emit('update:count', res.likeCount ?? optimisticCount)
  } catch (e) {
    // 请求失败：回滚到原状态
    emit('update:liked', prevLiked)
    emit('update:count', props.count)
    showToast({ type: 'fail', message: '操作失败' })
  } finally {
    pending.value = false
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
  0% {
    transform: scale(1);
  }
  30% {
    transform: scale(1.35);
  }
  60% {
    transform: scale(0.9);
  }
  100% {
    transform: scale(1);
  }
}
</style>
