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
        <div class="detail-comments-header">全部评论 ({{ post.comments?.length || 0 }})</div>
        <div v-for="comment in post.comments" :key="comment.id" class="detail-comment-item">
          <van-image round width="32" height="32" :src="comment.user.avatar" />
          <div class="detail-comment-content">
            <div class="detail-comment-nickname">{{ comment.user.nickname }}</div>
            <div class="detail-comment-text">
              <template v-if="comment.replyTo">
                <span class="reply-tag">回复</span>
                <span class="reply-nickname">@{{ comment.replyTo.nickname }}</span>
              </template>
              {{ comment.content }}
            </div>
            <div class="detail-comment-time">{{ formatRelativeTime(comment.createdAt) }}</div>
          </div>
          <van-icon
            v-if="comment.userId && comment.userId === currentUserId"
            name="cross"
            class="detail-comment-delete"
            @click="handleDeleteComment(comment)"
          />
        </div>
        <van-empty v-if="!post.comments?.length" description="暂无评论" />
      </div>
    </div>

    <div v-else class="detail-loading">
      <van-loading />
    </div>

    <div class="detail-input-bar">
      <van-field
        v-model="commentText"
        placeholder="写评论..."
        @keypress.enter="submitComment"
      >
        <template #button>
          <van-button
            size="small"
            type="primary"
            :disabled="!commentText.trim()"
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
import { getPostDetail } from '@/api/post'
import { createComment, deleteComment } from '@/api/comment'
import { formatRelativeTime } from '@/utils/time'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const post = ref(null)
const commentText = ref('')

const currentUserId = computed(() => userStore.userInfo?.id || 0)

onMounted(async () => {
  try {
    const res = await getPostDetail(route.params.id)
    post.value = res
  } catch (e) {
    showToast({ type: 'fail', message: '加载失败' })
  }
})

async function submitComment() {
  if (!commentText.value.trim()) return
  try {
    const res = await createComment({
      postId: route.params.id,
      content: commentText.value
    })
    // 后端直接返回评论对象（无 res.comment 包装）
    if (!post.value.comments) post.value.comments = []
    post.value.comments.push(res)
    post.value.commentCount = post.value.comments.length
    commentText.value = ''
    showToast({ type: 'success', message: '评论成功' })
  } catch (e) {
    showToast({ type: 'fail', message: '评论失败' })
  }
}

async function handleDeleteComment(comment) {
  try {
    await deleteComment(comment.id)
    const idx = post.value.comments.findIndex(c => c.id === comment.id)
    if (idx !== -1) post.value.comments.splice(idx, 1)
    post.value.commentCount = post.value.comments.length
    showToast({ type: 'success', message: '已删除' })
  } catch (e) {
    showToast({ type: 'fail', message: '删除失败' })
  }
}

function handleComment(_post) {
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
</style>
