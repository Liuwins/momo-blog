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
      <!-- 标签筛选 -->
      <div v-if="allTags.length" class="tag-filter">
        <span
          class="tag-filter-item"
          :class="{ active: !activeTag }"
          @click="filterByTag('')"
        >全部</span>
        <span
          v-for="tag in allTags"
          :key="tag.name"
          class="tag-filter-item"
          :class="{ active: activeTag === tag.name }"
          @click="filterByTag(tag.name)"
        >
          #{{ tag.name }}<sup v-if="tag.count > 1">{{ tag.count }}</sup>
        </span>
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
            @tag-click="handleTagClick"
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

    <!-- 评论弹窗 -->
    <van-popup
      v-model:show="showCommentPopup"
      position="bottom"
      :style="{ height: '60vh' }"
      round
    >
      <div class="comment-popup">
        <div class="comment-header">
          <span>评论 ({{ currentComments.length }})</span>
          <van-icon name="cross" @click="showCommentPopup = false" />
        </div>
        <div ref="commentBodyRef" class="comment-body">
          <div v-if="currentComments.length === 0" class="comment-empty">暂无评论</div>
          <div
            v-for="comment in currentComments"
            :key="comment.id"
            class="comment-item"
          >
            <van-image round width="32" height="32" :src="comment.avatar || defaultAvatar" />
            <div class="comment-item-content">
              <div class="comment-item-nickname">
                {{ comment.nickname || '匿名' }}
                <span v-if="comment.status === 'pending'" class="audit-tag">审核中</span>
              </div>
              <!-- 审核中：博主正常看内容（灰色斜体+审核中标签），游客模糊遮罩 -->
              <div class="comment-item-text" :class="{ 'audit-blur': comment.status === 'pending' && !userStore.isLoggedIn, 'pending': comment.status === 'pending' && userStore.isLoggedIn }">
                <template v-if="comment.replyTo">
                  <span class="reply-tag">回复</span>
                  <span class="reply-nickname">@{{ comment.replyTo.nickname }}</span>
                </template>
                {{ comment.content }}
              </div>
              <div class="comment-item-time">{{ formatRelativeTime(comment.createdAt) }}</div>
              <!-- 博主操作 -->
              <div v-if="userStore.isLoggedIn && comment.status === 'pending'" class="comment-actions">
                <span class="action-btn approve" @click="handleApproveComment(comment)">通过</span>
                <span class="action-btn reject" @click="handleRejectComment(comment)">拒绝</span>
              </div>
            </div>
          </div>
        </div>
        <div class="comment-input-bar">
          <div v-if="replyTo" class="reply-tag">
            <span>回复 @{{ replyTo.nickname }}</span>
            <van-icon name="cross" @click="clearReply" />
          </div>
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
            :placeholder="replyTo ? `回复 @${replyTo.nickname}` : '写评论...'"
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
    </van-popup>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { showToast } from 'vant'
import { getPosts, getTags, getComments, createComment, deleteComment, toggleLike, getLikeStatus, approveComment, rejectComment } from '@/api/post'
import { getVisitorId, getVisitorNickname, setVisitorNickname } from '@/utils/visitor'
import { formatRelativeTime } from '@/utils/time'

const router = useRouter()
const userStore = useUserStore()

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const error = ref(false)
const list = ref([])
const keyword = ref('')
const sortBy = ref('latest')
const allTags = ref([])
const activeTag = ref('')
const page = ref(1)
const pageSize = 10

const showCommentPopup = ref(false)
const commentText = ref('')
const commentNickname = ref('')
const currentPost = ref(null)
const currentComments = ref([])
const replyTo = ref(null)
const commentBodyRef = ref(null)
const defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=visitor'

// 搜索防抖
let searchTimer = null
function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    list.value = []
    page.value = 1
    finished.value = false
    error.value = false
    loading.value = false
    onLoad()
  }, 300)
}

async function onLoad() {
  loading.value = true
  try {
    const params = { page: page.value, pageSize: pageSize }
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    if (activeTag.value) params.tag = activeTag.value
    const res = await getPosts(params)
    if (res.list.length < pageSize) {
      finished.value = true
    }
    let newItems = res.list
    if (sortBy.value === 'hot') {
      newItems = [...newItems].sort((a, b) => b.likeCount - a.likeCount)
    }
    list.value.push(...newItems)
    page.value++
  } catch (e) {
    error.value = true
    showToast({ type: 'fail', message: '加载失败' })
  } finally {
    loading.value = false
  }
}

// 加载标签列表
async function loadTags() {
  try {
    allTags.value = await getTags()
  } catch (e) { /* 忽略 */ }
}

// 每次进入首页：重置状态，从头加载
onMounted(() => {
  list.value = []
  page.value = 1
  finished.value = false
  error.value = false
  loading.value = false
  loadTags()
  // 初始化游客昵称
  commentNickname.value = getVisitorNickname()
})

async function onRefresh() {
  list.value = []
  page.value = 1
  finished.value = false
  error.value = false
  loading.value = false
  refreshing.value = false
  await loadTags()
  await onLoad()
}

function changeSort(sort) {
  if (sortBy.value === sort) return
  sortBy.value = sort
  list.value = []
  page.value = 1
  finished.value = false
  error.value = false
  loading.value = false
  onLoad()
}

function filterByTag(tag) {
  activeTag.value = tag
  list.value = []
  page.value = 1
  finished.value = false
  error.value = false
  loading.value = false
  onLoad()
}

function handleTagClick(tag) {
  filterByTag(tag)
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

async function handleComment(post) {
  currentPost.value = post
  replyTo.value = null
  showCommentPopup.value = true
  // 加载评论列表（游客只返回已审核，博主返回所有）
  try {
    const comments = await getComments(post.id)
    currentComments.value = comments
  } catch (e) {
    currentComments.value = post.comments || []
  }
}

async function handleReply({ post, comment }) {
  currentPost.value = post
  replyTo.value = { id: comment.id, nickname: comment.nickname || comment.user?.nickname }
  showCommentPopup.value = true
  // 加载评论列表
  try {
    const comments = await getComments(post.id)
    currentComments.value = comments
  } catch (e) {
    currentComments.value = []
  }
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
  if (!userStore.isLoggedIn && !commentNickname.value.trim()) {
    showToast({ type: 'fail', message: '请输入昵称' })
    return
  }
  try {
    const payload = {
      postId: currentPost.value.id,
      content: commentText.value,
      replyTo: replyTo.value ? { id: replyTo.value.id, nickname: replyTo.value.nickname } : null
    }
    // 未登录时带上昵称和 visitorId
    if (!userStore.isLoggedIn) {
      payload.nickname = commentNickname.value.trim()
      payload.visitorId = getVisitorId()
      setVisitorNickname(commentNickname.value.trim())
    }
    const res = await createComment(payload)
    currentComments.value.push(res)
    if (currentPost.value) {
      currentPost.value.commentCount = currentComments.value.length
    }
    commentText.value = ''
    replyTo.value = null
    showToast({ type: 'success', message: '评论成功，等待审核' })
  } catch (e) {
    showToast({ type: 'fail', message: '评论失败' })
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

.tag-filter {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0 0;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.tag-filter::-webkit-scrollbar {
  display: none;
}

.tag-filter-item {
  flex-shrink: 0;
  font-size: 13px;
  color: #576b95;
  background: #f0f4fa;
  padding: 4px 12px;
  border-radius: 14px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.tag-filter-item.active {
  background: #576b95;
  color: #fff;
}

.tag-filter-item sup {
  font-size: 10px;
  margin-left: 2px;
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

.comment-empty {
  text-align: center;
  color: #999;
  padding: 40px 0;
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

.comment-item-text.pending {
  color: #999;
  font-style: italic;
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

.nickname-input {
  margin-bottom: 8px;
}

.nickname-input :deep(.van-field) {
  background: #f5f5f5;
  border-radius: 4px;
  padding: 4px 8px;
}
</style>
