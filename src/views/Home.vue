<template>
  <div class="home-page">
    <app-nav-bar title="MomoBlog">
      <template #right>
        <van-icon name="plus" size="20" class="nav-icon" @click="goPublish" />
      </template>
    </app-nav-bar>

    <div class="home-toolbar">
      <!-- 动态流切换：全部 / 关注（登录用户可见） -->
      <div v-if="userStore.isLoggedIn" class="feed-tabs">
        <span class="feed-tab" :class="{ active: feedType === 'all' }" @click="switchFeed('all')"
          >全部</span
        >
        <span
          class="feed-tab"
          :class="{ active: feedType === 'following' }"
          @click="switchFeed('following')"
          >关注</span
        >
      </div>
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
          >最新</span
        >
        <span class="sort-tab" :class="{ active: sortBy === 'hot' }" @click="changeSort('hot')"
          >最热</span
        >
      </div>
      <!-- 本周热门话题榜 -->
      <div v-if="hotTags.length" class="hot-tags">
        <span class="hot-label">🔥 热门</span>
        <div class="hot-tags-scroll">
          <span
            v-for="(tag, idx) in hotTags"
            :key="tag.name"
            class="hot-tag-item"
            :class="{ active: activeTag === tag.name }"
            @click="filterByTag(tag.name)"
          >
            <span class="hot-rank" :class="`rank-${idx + 1}`">{{ idx + 1 }}</span>
            #{{ tag.name }}
          </span>
        </div>
      </div>
      <!-- 标签筛选 -->
      <div v-if="allTags.length" class="tag-filter">
        <span class="tag-filter-item" :class="{ active: !activeTag }" @click="filterByTag('')"
          >全部</span
        >
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
    <van-popup v-model:show="showCommentPopup" position="bottom" :style="{ height: '60vh' }" round>
      <div class="comment-popup">
        <div class="comment-header">
          <span>评论 ({{ currentComments.length }})</span>
          <van-icon name="cross" @click="showCommentPopup = false" />
        </div>
        <div ref="commentBodyRef" class="comment-body">
          <div v-if="currentComments.length === 0" class="comment-empty">暂无评论</div>
          <div v-for="comment in currentComments" :key="comment.id" class="comment-item">
            <van-image round width="32" height="32" :src="comment.avatar || defaultAvatar" />
            <div class="comment-item-content">
              <div class="comment-item-nickname">
                {{ comment.nickname || '匿名' }}
                <span v-if="comment.status === 'pending'" class="audit-tag">审核中</span>
              </div>
              <!-- 审核中：博主正常看内容（灰色斜体+审核中标签），游客显示占位文本 -->
              <div
                class="comment-item-text"
                :class="{
                  'masked-text': comment.masked,
                  pending: comment.status === 'pending' && userStore.isLoggedIn
                }"
              >
                <template v-if="comment.replyTo">
                  <span class="reply-tag">回复</span>
                  <span class="reply-nickname">@{{ comment.replyTo.nickname }}</span>
                </template>
                {{ comment.content }}
              </div>
              <div class="comment-item-time">{{ formatRelativeTime(comment.createdAt) }}</div>
              <!-- 评论操作：回复 + 删除 -->
              <div class="comment-item-actions">
                <span class="action-btn reply" @click="handleReply(comment)">回复</span>
                <span
                  v-if="canDeleteComment(comment)"
                  class="action-btn delete"
                  @click="handleDeleteComment(comment)"
                  >删除</span
                >
              </div>
              <!-- 博主审核操作 -->
              <div
                v-if="userStore.isLoggedIn && comment.status === 'pending'"
                class="comment-actions"
              >
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
            <van-field v-model="commentNickname" placeholder="输入你的昵称" maxlength="20" />
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
                :disabled="
                  !commentText.trim() ||
                  submitting ||
                  (!userStore.isLoggedIn && !commentNickname.trim())
                "
                :loading="submitting"
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
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { showToast, showConfirmDialog } from 'vant'
import {
  getPosts,
  getTags,
  getComments,
  createComment,
  deleteComment,
  toggleLike,
  getLikeStatus,
  approveComment,
  rejectComment
} from '@/api/post'
import { getFollowingPosts } from '@/api/user'
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
const hotTags = ref([])
const activeTag = ref('')
const page = ref(1)
const pageSize = 10
// 动态流类型：全部 / 关注
const feedType = ref('all')

const showCommentPopup = ref(false)
const commentText = ref('')
const commentNickname = ref('')
const currentPost = ref(null)
const currentComments = ref([])
const replyTo = ref(null)
const commentBodyRef = ref(null)
const submitting = ref(false)
const defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=visitor'

// 搜索防抖
let searchTimer = null
function onSearch() {
  // 关注流下搜索，自动切回全部流
  feedType.value = 'all'
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
    let res
    if (feedType.value === 'following') {
      // 关注流：不支持搜索/标签筛选/排序
      res = await getFollowingPosts(page.value, pageSize)
    } else {
      const params = { page: page.value, pageSize: pageSize, sortBy: sortBy.value }
      if (keyword.value.trim()) params.keyword = keyword.value.trim()
      if (activeTag.value) params.tag = activeTag.value
      res = await getPosts(params)
    }
    if (res.list.length < pageSize) {
      finished.value = true
    }
    // 关注流返回的是 Post 实体，需适配 PostCard 的 user 嵌套结构
    const items = (res.list || []).map((p) =>
      p.user ? p : { ...p, user: { id: p.userId, nickname: p.nickname, avatar: p.avatar } }
    )
    list.value.push(...items)
    page.value++
  } catch (e) {
    error.value = true
    showToast({ type: 'fail', message: '加载失败' })
  } finally {
    loading.value = false
  }
}

// 切换动态流
function switchFeed(type) {
  if (feedType.value === type) return
  feedType.value = type
  list.value = []
  page.value = 1
  finished.value = false
  error.value = false
  loading.value = false
  onLoad()
}

// 加载标签列表（全量 + 本周热门 Top 6）
async function loadTags() {
  try {
    const [all, hot] = await Promise.all([getTags(), getTags('week')])
    allTags.value = all || []
    hotTags.value = (hot || []).slice(0, 6)
  } catch (e) {
    /* 忽略 */
  }
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

// 组件卸载时清理搜索定时器，防止内存泄漏
onUnmounted(() => {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
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
  feedType.value = 'all'
  sortBy.value = sort
  list.value = []
  page.value = 1
  finished.value = false
  error.value = false
  loading.value = false
  onLoad()
}

function filterByTag(tag) {
  feedType.value = 'all'
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

function handleReply(comment) {
  replyTo.value = { id: comment.id, nickname: comment.nickname || comment.user?.nickname || '匿名' }
}

function canDeleteComment(comment) {
  // 博主（已登录）可删除任意评论；评论作者可删除自己的评论
  if (userStore.isLoggedIn) return true
  return comment.userId && comment.userId === userStore.userInfo?.id
}

function clearReply() {
  replyTo.value = null
}

function updatePostLike(postId, field, value) {
  const post = list.value.find((p) => p.id === postId)
  if (post) post[field] = value
}

async function handleDeleteComment(comment) {
  try {
    await showConfirmDialog({ title: '提示', message: '确定删除这条评论吗？' })
  } catch {
    return
  }
  try {
    const ok = await deleteComment(comment.id)
    if (ok === false) {
      showToast({ type: 'fail', message: '无权删除' })
      return
    }
    // 同步当前评论弹窗列表
    const cIdx = currentComments.value.findIndex((c) => c.id === comment.id)
    if (cIdx !== -1) {
      currentComments.value.splice(cIdx, 1)
      if (currentPost.value) currentPost.value.commentCount = currentComments.value.length
    }
    // 同步 feed 列表中 post 的评论预览
    const post = list.value.find((p) => p.id === currentPost.value?.id)
    if (post && post.comments) {
      const idx = post.comments.findIndex((c) => c.id === comment.id)
      if (idx !== -1) {
        post.comments.splice(idx, 1)
        post.commentCount = (post.commentCount || 1) - 1
      }
    }
    showToast({ type: 'success', message: '已删除' })
  } catch (e) {
    showToast({ type: 'fail', message: '删除失败' })
  }
}

async function submitComment() {
  if (!commentText.value.trim()) return
  if (submitting.value) return
  if (!userStore.isLoggedIn && !commentNickname.value.trim()) {
    showToast({ type: 'fail', message: '请输入昵称' })
    return
  }
  submitting.value = true
  try {
    const payload = {
      postId: currentPost.value.id,
      content: commentText.value,
      replyToId: replyTo.value ? replyTo.value.id : undefined,
      replyToNickname: replyTo.value ? replyTo.value.nickname : undefined
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
  } finally {
    submitting.value = false
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

.feed-tabs {
  display: flex;
  gap: 20px;
  padding: 4px 0 8px;
}

.feed-tab {
  font-size: 15px;
  color: #666;
  cursor: pointer;
  padding: 2px 0;
}

.feed-tab.active {
  color: #07c160;
  font-weight: 600;
  font-size: 17px;
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
  color: #07c160;
  font-weight: 500;
}

.hot-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  margin-top: 4px;
}

.hot-label {
  font-size: 12px;
  color: #ee0a24;
  font-weight: 500;
  flex-shrink: 0;
}

.hot-tags-scroll {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.hot-tags-scroll::-webkit-scrollbar {
  display: none;
}

.hot-tag-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 13px;
  color: #576b95;
  background: #f0f4fa;
  padding: 3px 10px;
  border-radius: 12px;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
}

.hot-tag-item.active {
  background: #07c160;
  color: #fff;
}

.hot-rank {
  font-size: 10px;
  font-weight: 700;
  width: 14px;
  height: 14px;
  line-height: 14px;
  text-align: center;
  border-radius: 50%;
  color: #999;
  background: #e0e0e0;
}

.hot-rank.rank-1 {
  color: #fff;
  background: #ee0a24;
}

.hot-rank.rank-2 {
  color: #fff;
  background: #ff7a00;
}

.hot-rank.rank-3 {
  color: #fff;
  background: #ffb300;
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

.comment-item-text.masked-text {
  color: #999;
  font-style: italic;
  background: #f5f5f5;
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
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
  color: #07c160;
  background: #e8f5e9;
}

.action-btn.reject {
  color: #ee0a24;
  background: #ffebee;
}

.comment-item-actions {
  margin-top: 4px;
  display: flex;
  gap: 12px;
}

.comment-item-actions .action-btn {
  color: #576b95;
  background: transparent;
  padding: 2px 0;
}

.comment-item-actions .action-btn.delete {
  color: #999;
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
