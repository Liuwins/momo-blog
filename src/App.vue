<template>
  <div class="page-container" :class="{ 'page-container--with-tab': showTabBar }">
    <router-view />
    <TabBar v-if="showTabBar" />
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useNotificationStore } from '@/stores/notification'
import TabBar from '@/components/TabBar.vue'

const route = useRoute()
const userStore = useUserStore()
const notificationStore = useNotificationStore()

const showTabBar = computed(() => {
  if (!userStore.isLoggedIn) return false
  if (route.path === '/') return true
  if (route.path === '/publish') return true
  if (route.path.startsWith('/profile')) return true
  if (route.path.startsWith('/notifications')) return true
  return false
})

// 登录状态变化时连接/断开 WebSocket
watch(
  () => userStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) {
      notificationStore.connect()
    } else {
      notificationStore.disconnect()
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.page-container--with-tab {
  padding-bottom: 50px;
}
</style>
