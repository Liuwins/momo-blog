<template>
  <div class="page-container" :class="{ 'page-container--with-tab': showTabBar }">
    <router-view />
    <TabBar v-if="showTabBar" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import TabBar from '@/components/TabBar.vue'

const route = useRoute()
const userStore = useUserStore()

const showTabBar = computed(() => {
  if (!userStore.isLoggedIn) return false
  if (route.path === '/') return true
  if (route.path === '/publish') return true
  if (route.path.startsWith('/profile')) return true
  return false
})
</script>

<style scoped>
.page-container--with-tab {
  padding-bottom: 50px;
}
</style>
