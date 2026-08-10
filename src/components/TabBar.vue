<template>
  <van-tabbar v-model="active" route>
    <van-tabbar-item icon="home-o" to="/">首页</van-tabbar-item>
    <van-tabbar-item icon="add-o" @click="handlePublish">发布</van-tabbar-item>
    <van-tabbar-item icon="bell-o" to="/notifications" :badge="unreadCount || ''"
      >通知</van-tabbar-item
    >
    <van-tabbar-item icon="user-o" :to="profilePath">我的</van-tabbar-item>
  </van-tabbar>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useNotificationStore } from '@/stores/notification'

const router = useRouter()
const userStore = useUserStore()
const notificationStore = useNotificationStore()

const unreadCount = computed(() => notificationStore.unreadCount)

const active = computed({
  get() {
    const path = router.currentRoute.value.path
    if (path === '/') return 0
    if (path === '/publish') return 1
    if (path.startsWith('/notifications')) return 2
    if (path.startsWith('/profile')) return 3
    return 0
  },
  set() {}
})

const profilePath = computed(() => {
  if (!userStore.isLoggedIn) return '/login'
  const id = userStore.userInfo?.id
  return id ? `/profile/${id}` : '/profile'
})

onMounted(() => {
  if (userStore.isLoggedIn) {
    notificationStore.fetchUnreadCount()
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
