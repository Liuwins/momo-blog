<template>
  <div class="post-card">
    <div class="post-header">
      <van-image
        round
        width="40"
        height="40"
        :src="post.user.avatar"
        class="avatar"
        @click="goProfile"
      />
      <div class="header-info">
        <div class="nickname" @click="goProfile">{{ post.user.nickname }}</div>
        <div class="time">{{ formatRelativeTime(post.createdAt) }}</div>
      </div>
      <!-- 自己的文章：更多菜单 -->
      <van-icon
        v-if="isOwner"
        name="ellipsis"
        size="20"
        color="#999"
        class="more-btn"
        @click="showMenu = true"
      />
    </div>

    <div v-if="post.content" class="post-content">
      <div ref="contentRef" class="content-text" :class="{ collapsed: contentCollapsed }">
        <MarkdownView v-if="isMarkdown" :content="post.content" />
        <template v-else>{{ post.content }}</template>
      </div>
      <div
        v-if="showFullBtn"
        class="full-btn"
        @click="contentCollapsed = !contentCollapsed"
      >
        {{ contentCollapsed ? '全文' : '收起' }}
      </div>
    </div>

    <ImageGrid :images="post.images" class="post-images" />

    <div class="post-actions">
      <LikeButton
        :post-id="post.id"
        :liked="post.liked"
        :count="post.likeCount"
        @update:liked="emit('update:liked', $event)"
        @update:count="emit('update:count', $event)"
      />
      <div class="action-item" @click="handleComment">
        <van-icon name="chat-o" size="20" color="#333" />
        <span class="action-text">{{ post.commentCount > 0 ? post.commentCount : '评论' }}</span>
      </div>
    </div>

    <div v-if="post.likeUsers && post.likeUsers.length > 0" class="like-users">
      <van-icon name="like" color="#ee0a24" size="12" />
      <span class="like-users-text">
        {{ post.likeUsers.slice(0, 3).map(u => u.nickname).join('、') }}
        <template v-if="post.likeUsers.length > 3">
          等 {{ post.likeUsers.length }} 人赞了
        </template>
        <template v-else>
          赞了
        </template>
      </span>
    </div>

    <CommentList
      :comments="post.comments"
      :current-user-id="currentUserId"
      @view-all="handleViewAll"
      @reply="handleReply"
      @delete="handleDeleteComment"
    />

    <!-- 操作菜单（朋友圈风格） -->
    <van-action-sheet
      v-model:show="showMenu"
      :actions="actions"
      cancel-text="取消"
      @select="handleMenuSelect"
      close-on-click-action
    />
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { formatRelativeTime } from '@/utils/time'
import { deletePost } from '@/api/post'
import MarkdownView from '@/components/MarkdownView.vue'

const props = defineProps({
  post: { type: Object, required: true },
  currentUserId: { type: Number, default: 0 }
})

const emit = defineEmits(['comment', 'view-all', 'reply', 'delete-comment', 'update:liked', 'update:count', 'deleted'])
const router = useRouter()
const contentCollapsed = ref(true)
const showFullBtn = ref(false)
const contentRef = ref(null)
const showMenu = ref(false)

const isOwner = computed(() => props.currentUserId && props.post.userId === props.currentUserId)

// 判断是否包含 markdown 语法（避免普通文本误渲染）
const MD_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|^#{1,4}\s|^>\s|^[-*+]\s|^```|\[[^\]]+\]\([^)]+\)|!\[[^\]]*\]\([^)]+\))/m
const isMarkdown = computed(() => {
  const c = props.post.content || ''
  return MD_PATTERN.test(c) && c.length < 5000
})

const actions = computed(() => {
  const list = [{ name: '编辑', key: 'edit' }]
  list.push({ name: '删除', key: 'delete', color: '#ee0a24' })
  return list
})

onMounted(async () => {
  await nextTick()
  if (contentRef.value) {
    showFullBtn.value = contentRef.value.scrollHeight > contentRef.value.clientHeight
  }
})

function goProfile() {
  router.push(`/profile/${props.post.userId}`)
}

function handleComment() {
  emit('comment', props.post)
}

function handleViewAll() {
  router.push(`/post/${props.post.id}`)
}

function handleReply(comment) {
  emit('reply', { post: props.post, comment })
}

function handleDeleteComment(comment) {
  emit('delete-comment', { post: props.post, comment })
}

async function handleMenuSelect(action) {
  if (action.key === 'edit') {
    router.push({ path: '/publish', query: { edit: props.post.id } })
  } else if (action.key === 'delete') {
    try {
      await showConfirmDialog({
        title: '确定删除这条动态吗？',
        message: '删除后不可恢复'
      })
      await deletePost(props.post.id)
      showToast({ type: 'success', message: '已删除' })
      emit('deleted', props.post.id)
    } catch (e) {
      if (e !== 'cancel') {
        showToast({ type: 'fail', message: '删除失败' })
      }
    }
  }
}
</script>

<style scoped>
.post-card {
  background: #fff;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.post-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
}

.avatar {
  flex-shrink: 0;
}

.header-info {
  flex: 1;
  min-width: 0;
}

.nickname {
  font-size: 15px;
  font-weight: 500;
  color: #333;
  line-height: 1.4;
  cursor: pointer;
}

.time {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.more-btn {
  flex-shrink: 0;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
}

.more-btn:active {
  background: #f5f5f5;
}

.post-content {
  margin-bottom: 10px;
}

.content-text {
  font-size: 15px;
  line-height: 1.6;
  color: #333;
  word-break: break-word;
}

.content-text.collapsed {
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.full-btn {
  color: #576b95;
  font-size: 14px;
  margin-top: 4px;
  cursor: pointer;
}

.post-images {
  margin-bottom: 10px;
}

.post-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-top: 8px;
  border-top: 1px solid #f5f5f5;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  user-select: none;
}

.action-text {
  font-size: 13px;
  color: #666;
}

.like-users {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding: 4px 0;
  font-size: 13px;
  color: #666;
}

.like-users .van-icon {
  flex-shrink: 0;
}

.like-users-text {
  flex: 1;
  color: #576b95;
}
</style>