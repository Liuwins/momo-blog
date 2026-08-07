<template>
  <div class="home-page">
    <app-nav-bar title="MomoBlog">
      <template #right>
        <van-icon name="plus" size="20" class="nav-icon" @click="goPublish" />
      </template>
    </app-nav-bar>

    <div class="home-toolbar">
      <van-search
        v-model="keyword"
        placeholder="搜索内容"
        class="home-search"
        @search="onSearch"
        @clear="onSearch"
      />
      <div class="sort-tabs">
        <span
          class="sort-tab"
          :class="{ active: sortBy === 'latest' }"
          @click="changeSort('latest')"
        >最新</span>
        <span
          class="sort-tab"
          :class="{ active: sortBy === 'hot' }"
          @click="changeSort('hot')"
        >最热</span>
      </div>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        :error="error"
        finished-text="没有更多了"
        error-text="加载失败，点击重试"
        @load="onLoad"
      >
        <template v-if="list.length > 0">
          <PostCard
            v-for="item in list"
            :key="item.id"
            :post="item"
            :current-user-id="userStore.userInfo?.id || 0"
            @comment="handleComment"
            @reply="handleReply"
            @delete-comment="handleDeleteComment"
            @update:liked="updatePostLike(item.id, 'liked', $event)"
            @update:count="updatePostLike(item.id, 'likeCount', $event)"
            @deleted="handleDeleted"
          />
        </template>
        <template v-else-if="loading">
          <div v-for="i in 3" :key="i" class="skeleton-card">
            <van-skeleton :row="3" :animate="false" />
          </div>
        </template>
        <div v-else class="empty-state">
          <van-empty description="暂无动态" />
        </div>
      </van-list>
    </van-pull-refresh>

    <van-popup
      v-model:show="showCommentPopup"
      position="bottom"
      :style="{ height: '50vh' }"
      round
    >
      <div class="comment-popup">
        <div class="comment-header">
          <span>评论</span>
          <van-icon name="cross" @click="showCommentPopup = false" />
        </div>
        <div ref="commentBodyRef" class="comment-body">
          <div
            v-for="comment in currentComments"
            :key="comment.id"
            class="comment-item"
          >
            <van-image round width="32" height="32" :src="comment.user.avatar" />
            <div class="comment-item-content">
              <div class="comment-item-nickname">{{ comment.user.nickname }}</div>
              <div class="comment-item-text">
                <template v-if="comment.replyTo">
                  <span class="reply-tag">回复</span>
                  <span class="reply-nickname">@{{ comment.replyTo.nickname }}</span>
                </template>
                {{ comment.content }}
              </div>
              <div class="comment-item-time">{{ comment.createdAt }}</div>
            </div>
          </div>
        </div>
        <div class="comment-input-bar">
          <div v-if="replyTo" class="reply-tag">
            <span>回复 @{{ replyTo.nickname }}</span>
            <van-icon name="cross" @click="clearReply" />
          </div>
          <van-field
            v-model="commentText"
            :placeholder="replyTo ? `回复 @${replyTo.nickname}` : '写评论...'"
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
    </van-popup>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useFeedStore } from '@/stores/feed'
import { useUserStore } from '@/stores/user'
import { showToast } from 'vant'
import { getPosts } from '@/api/post'
import { createComment, deleteComment } from '@/api/comment'

const router = useRouter()
const store = useFeedStore()
const userStore = useUserStore()

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const error = ref(false)
const list = ref([])
const keyword = ref('')
const sortBy = ref('latest')

const showCommentPopup = ref(false)
const commentText = ref('')
const currentPost = ref(null)
const currentComments = ref([])
const replyTo = ref(null)
const commentBodyRef = ref(null)

async function onLoad() {
  loading.value = true
  try {
    const params = { page: store.page, pageSize: store.pageSize }
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    const res = await getPosts(params)
    if (res.list.length < store.pageSize) {
      finished.value = true
    }
    let newItems = res.list
    if (sortBy.value === 'hot') {
      newItems = [...newItems].sort((a, b) => b.likeCount - a.likeCount)
    }
    list.value.push(...newItems)
    store.page++
  } catch (e) {
    error.value = true
    showToast({ type: 'fail', message: '加载失败' })
  } finally {
    loading.value = false
  }
}

async function onRefresh() {
  list.value = []
  store.page = 1
  finished.value = false
  error.value = false
  loading.value = false
  refreshing.value = false
  await onLoad()
}

function onSearch() {
  list.value = []
  store.page = 1
  finished.value = false
  error.value = false
  loading.value = false
  onLoad()
}

function changeSort(sort) {
  if (sortBy.value === sort) return
  sortBy.value = sort
  list.value = []
  store.page = 1
  finished.value = false
  error.value = false
  loading.value = false
  onLoad()
}

function goPublish() {
  if (userStore.isLoggedIn) {
    router.push('/publish')
  } else {
    router.push({ path: '/login', query: { redirect: '/publish' } })
  }
}

function handleDeleted(postId) {
  const idx = list.value.findIndex((p) => p.id === postId)
  if (idx !== -1) list.value.splice(idx, 1)
}

function handleComment(post) {
  currentPost.value = post
  currentComments.value = post.comments || []
  replyTo.value = null
  showCommentPopup.value = true
}

function handleReply({ post, comment }) {
  currentPost.value = post
  currentComments.value = post.comments || []
  replyTo.value = { id: comment.id, nickname: comment.user?.nickname }
  showCommentPopup.value = true
}

function clearReply() {
  replyTo.value = null
}

function updatePostLike(postId, field, value) {
  const post = list.value.find(p => p.id === postId)
  if (post) post[field] = value
}

async function handleDeleteComment({ post, comment }) {
  try {
    await deleteComment(comment.id)
    const list = post.comments || []
    const idx = list.findIndex(c => c.id === comment.id)
    if (idx !== -1) list.splice(idx, 1)
    post.commentCount = list.length
    showToast({ type: 'success', message: '已删除' })
  } catch (e) {
    showToast({ type: 'fail', message: '删除失败' })
  }
}

async function submitComment() {
  if (!commentText.value.trim()) return
  try {
    const res = await createComment({
      postId: currentPost.value.id,
      content: commentText.value,
      replyTo: replyTo.value ? { id: replyTo.value.id, nickname: replyTo.value.nickname } : null
    })
    // 后端直接返回评论对象，没有 res.comment 包装
    currentComments.value.push(res)
    if (currentPost.value) {
      currentPost.value.commentCount = currentComments.value.length
    }
    commentText.value = ''
    replyTo.value = null
    showToast({ type: 'success', message: '评论成功' })
  } catch (e) {
    showToast({ type: 'fail', message: '评论失败' })
  }
}
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  background: #fff;
}

.empty-state {
  padding: 40px 0;
}

.skeleton-card {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.home-toolbar {
  background: #fff;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
}

.home-search {
  padding: 0 0 8px;
}

.sort-tabs {
  display: flex;
  gap: 16px;
}

.sort-tab {
  font-size: 13px;
  color: #666;
  padding: 4px 0;
  cursor: pointer;
}

.sort-tab.active {
  color: #07C160;
  font-weight: 500;
}

.nav-icon {
  padding: 0 6px;
  color: #333;
}

.comment-popup {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  font-size: 16px;
  font-weight: 500;
  border-bottom: 1px solid #f0f0f0;
}

.comment-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.comment-item {
  display: flex;
  gap: 10px;
  padding: 10px 0;
}

.comment-item-content {
  flex: 1;
  min-width: 0;
}

.comment-item-nickname {
  font-size: 13px;
  color: #576b95;
  font-weight: 500;
}

.comment-item-text {
  font-size: 14px;
  color: #333;
  margin-top: 2px;
  line-height: 1.4;
}

.reply-tag {
  color: #999;
}

.reply-nickname {
  color: #576b95;
}

.comment-item-time {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.reply-indicator {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f0f2f5;
  color: #576b95;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  margin-bottom: 6px;
}

.reply-indicator .van-icon {
  cursor: pointer;
  color: #999;
}

.comment-input-bar {
  border-top: 1px solid #f0f0f0;
  padding: 8px 12px;
}
</style>
