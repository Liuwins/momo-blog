import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getPosts } from '@/api/post'

export const useFeedStore = defineStore('feed', () => {
  const list = ref([])
  const loading = ref(false)
  const finished = ref(false)
  const error = ref(false)
  const page = ref(1)
  const pageSize = 10

  async function loadMore() {
    if (loading.value || finished.value) return
    loading.value = true
    error.value = false
    try {
      const res = await getPosts({ page: page.value, pageSize })
      if (res.list.length < pageSize) {
        finished.value = true
      }
      list.value.push(...res.list)
      page.value++
    } catch (e) {
      error.value = true
      throw e
    } finally {
      loading.value = false
    }
  }

  function refresh() {
    list.value = []
    page.value = 1
    finished.value = false
    error.value = false
    loading.value = false
  }

  return {
    list,
    loading,
    finished,
    error,
    page,
    pageSize,
    loadMore,
    refresh
  }
})
