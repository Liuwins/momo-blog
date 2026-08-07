<template>
  <van-tabbar v-model="active" route>
    <van-tabbar-item icon="home-o" to="/">首页</van-tabbar-item>
    <van-tabbar-item icon="add-o" @click="handlePublish">发布</van-tabbar-item>
    <van-tabbar-item icon="user-o" :to="profilePath">我的</van-tabbar-item>
  </van-tabbar>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const active = computed({
  get() {
    const path = router.currentRoute.value.path
    if (path === '/') return 0
    if (path === '/publish') return 1
    if (path.startsWith('/profile')) return 2
    return 0
  },
  set() {}
})

const profilePath = computed(() => {
  if (!userStore.isLoggedIn) return '/login'
  const id = userStore.userInfo?.id
  return id ? `/profile/${id}` : '/profile'
})

// 刷新后 userInfo 为 null 时，尝试从 token 恢复用户信息
onMounted(() => {
  if (userStore.isLoggedIn && !userStore.userInfo) {
    // token 里没有用户 id，尝试用当前用户接口获取
    // 后端没有 /users/me，先用 id=1 兜底会失败，所以这里不主动 fetch
    // 改为依赖 localStorage 持久化的 userInfo（已在 store 中处理）
  }
})

function handlePublish() {
  if (userStore.isLoggedIn) {
    router.push('/publish')
  } else {
    router.push({ path: '/login', query: { redirect: '/publish' } })
  }
}
</script>
