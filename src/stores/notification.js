import { defineStore } from 'pinia'
import { ref } from 'vue'
import { io } from 'socket.io-client'
import { getUnreadCount } from '@/api/notification'
import { useUserStore } from './user'

export const useNotificationStore = defineStore('notification', () => {
  const unreadCount = ref(0)
  let socket = null

  function connect() {
    const userStore = useUserStore()
    if (!userStore.isLoggedIn) return
    if (socket) return
    const userId = userStore.userInfo?.id
    if (!userId) return

    socket = io('/notifications', {
      auth: { userId },
      transports: ['websocket']
    })

    socket.on('notification', () => {
      unreadCount.value++
    })

    socket.on('unreadUpdate', (data) => {
      unreadCount.value = data.count
    })
  }

  function disconnect() {
    if (socket) {
      socket.disconnect()
      socket = null
    }
    unreadCount.value = 0
  }

  async function fetchUnreadCount() {
    try {
      const count = await getUnreadCount()
      unreadCount.value = count
    } catch {
      /* ignore */
    }
  }

  return { unreadCount, connect, disconnect, fetchUnreadCount }
})
