<template>
  <div class="notifications-page">
    <app-nav-bar title="通知" show-back @click-left="goBack">
      <template #right>
        <span
          class="mark-read-btn"
          :class="{ disabled: markingRead || list.every((i) => i.isRead) }"
          @click="handleMarkAllRead"
          >{{ markingRead ? '处理中...' : '全部已读' }}</span
        >
      </template>
    </app-nav-bar>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        :error="error"
        error-text="加载失败，点击重试"
        @load="onLoad"
      >
        <div
          v-for="item in list"
          :key="item.id"
          class="notification-item"
          :class="{ unread: !item.isRead }"
          @click="handleClick(item)"
        >
          <img class="avatar" :src="item.sender?.avatar || defaultAvatar" alt="" />
          <div class="content">
            <div class="title">
              <span class="nickname">{{ item.sender?.nickname || '游客' }}</span>
              <span class="action">{{ actionText(item.type) }}</span>
            </div>
            <div v-if="item.content" class="text">{{ item.content }}</div>
            <div class="time">{{ formatRelativeTime(item.createdAt) }}</div>
          </div>
          <span v-if="!item.isRead" class="unread-dot"></span>
        </div>
        <van-empty v-if="!loading && list.length === 0" description="暂无通知" />
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getNotifications, markAllRead } from '@/api/notification'
import { useNotificationStore } from '@/stores/notification'
import { formatRelativeTime } from '@/utils/time'

const router = useRouter()
const notificationStore = useNotificationStore()

const list = ref([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const error = ref(false)
const page = ref(1)
const pageSize = 20
const defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest'
// 防重复提交：标记全部已读进行中
const markingRead = ref(false)

function actionText(type) {
  const map = { like: '赞了你的文章', comment: '评论了你的文章', reply: '回复了你的评论' }
  return map[type] || '通知'
}

async function onLoad() {
  try {
    error.value = false
    loading.value = true
    const res = await getNotifications({ page: page.value, pageSize })
    const newList = res.list || []
    if (refreshing.value) {
      list.value = newList
      refreshing.value = false
    } else {
      list.value = [...list.value, ...newList]
    }
    if (list.value.length >= (res.total || 0)) {
      finished.value = true
    } else {
      page.value++
    }
  } catch (e) {
    error.value = true
    showToast('加载失败')
  } finally {
    loading.value = false
  }
}

function onRefresh() {
  page.value = 1
  finished.value = false
  refreshing.value = true
  onLoad()
}

async function handleMarkAllRead() {
  // 防重复：进行中直接忽略
  if (markingRead.value) return
  // 无未读：无需请求
  if (list.value.every((i) => i.isRead)) {
    showToast('暂无未读通知')
    return
  }
  markingRead.value = true
  try {
    await markAllRead()
    list.value.forEach((item) => (item.isRead = true))
    notificationStore.unreadCount = 0
    showToast('已全部已读')
  } catch (e) {
    showToast({ type: 'fail', message: '操作失败，请重试' })
  } finally {
    markingRead.value = false
  }
}

function handleClick(item) {
  if (!item.isRead) {
    item.isRead = true
    notificationStore.unreadCount = Math.max(0, notificationStore.unreadCount - 1)
  }
  if (item.postId) {
    router.push(`/post/${item.postId}`)
  }
}

function goBack() {
  router.back()
}

onMounted(() => {
  if (notificationStore.unreadCount > 0) {
    // 同步已有未读数
  }
})
</script>

<style scoped>
.notifications-page {
  min-height: 100vh;
  background: #f7f8fa;
}
.mark-read-btn {
  color: #1989fa;
  font-size: 14px;
  cursor: pointer;
}
.mark-read-btn.disabled {
  color: #c8c9cc;
  cursor: not-allowed;
}
.notification-item {
  display: flex;
  align-items: flex-start;
  padding: 16px;
  background: #fff;
  border-bottom: 1px solid #f5f5f5;
  position: relative;
}
.notification-item.unread {
  background: #fafbff;
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-right: 12px;
  flex-shrink: 0;
}
.content {
  flex: 1;
  min-width: 0;
}
.title {
  font-size: 15px;
  color: #323233;
  margin-bottom: 4px;
}
.nickname {
  font-weight: 600;
  margin-right: 4px;
}
.action {
  color: #646566;
}
.text {
  font-size: 13px;
  color: #7d7e80;
  margin: 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.time {
  font-size: 12px;
  color: #c8c9cc;
}
.unread-dot {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ee0a24;
  flex-shrink: 0;
}
</style>
