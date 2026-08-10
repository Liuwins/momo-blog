<template>
  <div class="post-detail-page">
    <app-nav-bar title="动态详情" show-back />

    <div v-if="post" class="detail-body">
      <PostCard
        :post="post"
        :current-user-id="currentUserId"
        @comment="handleComment"
        @update:liked="post.liked = $event"
        @update:count="post.likeCount = $event"
        @delete-comment="handleDeleteComment"
        @deleted="handleDeleted"
      />

      <div class="detail-comments">
        <div class="detail-comments-header">全部评论 ({{ comments.length }})</div>
        <div v-if="comments.length === 0" class="detail-comments-empty">暂无评论</div>
        <div v-for="comment in comments" :key="comment.id" class="detail-comment-item">
          <van-image round width="32" height="32" :src="comment.avatar || defaultAvatar" />
          <div class="detail-comment-content">
            <div class="detail-comment-nickname">
              {{ comment.nickname || '匿名' }}
              <span v-if="comment.status === 'pending'" class="audit-tag">审核中</span>
            </div>
            <!-- 审核中：博主正常看内容（灰色斜体+审核中标签），游客模糊遮罩 -->
            <div class="detail-comment-text" :class="{ 'audit-blur': comment.status === 'pending' && !userStore.isLoggedIn, 'pending': comment.status === 'pending' && userStore.isLoggedIn }">
              <template v-if="comment.replyTo">
                <span class="reply-tag">回复</span>
                <span class="reply-nickname">@{{ comment.replyTo.nickname }}</span>
              </template>
              {{ comment.content }}
            </div>
            <div class="detail-comment-time">{{ formatRelativeTime(comment.createdAt) }}</div>
            <!-- 博主操作 -->
            <div v-if="userStore.isLoggedIn && comment.status === 'pending'" class="comment-actions">
              <span class="action-btn approve" @click="handleApproveComment(comment)">通过</span>
              <span class="action-btn reject" @click="handleRejectComment(comment)">拒绝</span>
            </div>
          </div>
          <van-icon
            v-if="comment.userId && comment.userId === currentUserId"
            name="cross"
            class="detail-comment-delete"
            @click="handleDeleteComment(comment)"
          />
        </div>
      </div>
    </div>

    <div v-else class="detail-loading">
      <van-loading />
    </div>

    <div class="detail-input-bar">
      <!-- 未登录时输入昵称 -->
      <div v-if="!userStore.isLoggedIn" class="nickname-input">
        <van-field
          v-model="commentNickname"
          placeholder="输入你的昵称"
          maxlength="20"
        />
      </div>
      <van-field
        v-model="commentText"
        placeholder="写评论..."
        @keypress.enter="submitComment"
      >
        <template #button>
          <van-button
            size="small"
            type="primary"
            :disabled="!commentText.trim() || (!userStore.isLoggedIn && !commentNickname.trim())"
            @click="submitComment"
          >
            发送
          </van-button>
        </template>
      </van-field>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useUserStore } from '@/stores/user'
import { getPostDetail, getComments, createComment, deleteComment, approveComment, rejectComment } from '@/api/post'
import { getVisitorId, getVisitorNickname, setVisitorNickname } from '@/utils/visitor'
import { formatRelativeTime } from '@/utils/time'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const post = ref(null)
const comments = ref([])
const commentText = ref('')
const commentNickname = ref('')
const defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=visitor'

const currentUserId = computed(() => userStore.userInfo?.id || 0)

onMounted(async () => {
  try {
    const res = await getPostDetail(route.params.id)
    post.value = res
    // 加载评论列表
    await loadComments()
    // 初始化游客昵称
    commentNickname.value = getVisitorNickname()
  } catch (e) {
    showToast({ type: 'fail', message: '加载失败' })
  }
})

async function loadComments() {
  try {
    const list = await getComments(route.params.id)
    comments.value = list
  } catch (e) {
    comments.value = []
  }
}

function handleComment(_post) {
  // 滚动到评论区域
  document.querySelector('.detail-comments')?.scrollIntoView({ behavior: 'smooth' })
}

async function submitComment() {
  if (!commentText.value.trim()) return
  if (!userStore.isLoggedIn && !commentNickname.value.trim()) {
    showToast({ type: 'fail', message: '请输入昵称' })
    return
  }
  try {
    const payload = {
      postId: route.params.id,
      content: commentText.value
    }
    // 未登录时带上昵称和 visitorId
    if (!userStore.isLoggedIn) {
      payload.nickname = commentNickname.value.trim()
      payload.visitorId = getVisitorId()
      setVisitorNickname(commentNickname.value.trim())
    }
    const res = await createComment(payload)
    comments.value.push(res)
    if (post.value) {
      post.value.commentCount = comments.value.length
    }
    commentText.value = ''
    showToast({ type: 'success', message: '评论成功，等待审核' })
  } catch (e) {
    showToast({ type: 'fail', message: '评论失败' })
  }
}

async function handleDeleteComment(comment) {
  try {
    await deleteComment(comment.id)
    const idx = comments.value.findIndex(c => c.id === comment.id)
    if (idx !== -1) comments.value.splice(idx, 1)
    if (post.value) post.value.commentCount = comments.value.length
    showToast({ type: 'success', message: '已删除' })
  } catch (e) {
    showToast({ type: 'fail', message: '删除失败' })
  }
}

async function handleApproveComment(comment) {
  try {
    await approveComment(comment.id)
    comment.status = 'approved'
    showToast({ type: 'success', message: '已通过' })
  } catch (e) {
    showToast({ type: 'fail', message: '操作失败' })
  }
}

async function handleRejectComment(comment) {
  try {
    await rejectComment(comment.id)
    comment.status = 'rejected'
    showToast({ type: 'success', message: '已拒绝' })
  } catch (e) {
    showToast({ type: 'fail', message: '操作失败' })
  }
}

function handleDeleted() {
  showToast({ type: 'success', message: '已删除' })
  router.back()
}
</script>

<style scoped>
.post-detail-page {
  min-height: 100vh;
  background: #fff;
  padding-bottom: 60px;
}

.detail-body {
  padding-bottom: 60px;
}

.detail-comments {
  padding: 16px;
}

.detail-comments-header {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 12px;
  color: #333;
}

.detail-comments-empty {
  text-align: center;
  color: #999;
  padding: 40px 0;
}

.detail-comment-item {
  display: flex;
  gap: 10px;
  padding: 10px 0;
}

.detail-comment-content {
  flex: 1;
  min-width: 0;
}

.detail-comment-nickname {
  font-size: 13px;
  color: #576b95;
  font-weight: 500;
}

.audit-tag {
  font-size: 10px;
  color: #ff9800;
  background: #fff3e0;
  padding: 1px 6px;
  border-radius: 3px;
  margin-left: 6px;
}

.audit-blur {
  filter: blur(5px);
  user-select: none;
  pointer-events: none;
  color: #999 !important;
}

.detail-comment-text.pending {
  color: #999;
  font-style: italic;
}

.detail-comment-text {
  font-size: 14px;
  color: #333;
  margin-top: 2px;
  line-height: 1.4;
}

.detail-comment-time {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.comment-actions {
  margin-top: 6px;
  display: flex;
  gap: 8px;
}

.action-btn {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.action-btn.approve {
  color: #07C160;
  background: #e8f5e9;
}

.action-btn.reject {
  color: #ee0a24;
  background: #ffebee;
}

.detail-comment-delete {
  color: #c8c9cc;
  font-size: 12px;
  padding: 4px;
  cursor: pointer;
  align-self: flex-start;
  flex-shrink: 0;
}

.detail-comment-delete:active {
  color: #ee0a24;
}

.reply-tag {
  color: #999;
}

.reply-nickname {
  color: #576b95;
}

.detail-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.detail-input-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: var(--max-width);
  margin: 0 auto;
  background: #fff;
  border-top: 1px solid #f0f0f0;
  padding: 8px 12px;
}

.nickname-input {
  margin-bottom: 8px;
}

.nickname-input :deep(.van-field) {
  background: #f5f5f5;
  border-radius: 4px;
  padding: 4px 8px;
}
</style>
