<template>
  <div class="profile-page">
    <app-nav-bar title="个人主页" show-back />

    <div class="profile-header">
      <div class="profile-bg"></div>
      <div class="profile-info">
        <div v-if="isOwner" class="avatar-wrapper" @click="showEdit = true">
          <van-image round width="64" height="64" :src="profile.avatar" class="profile-avatar" />
          <div class="avatar-edit-mask">
            <van-icon name="photograph" color="#fff" size="16" />
          </div>
        </div>
        <van-image
          v-else
          round
          width="64"
          height="64"
          :src="profile.avatar"
          class="profile-avatar"
        />
        <div class="profile-nickname">{{ profile.nickname }}</div>
        <div class="profile-signature">{{ profile.signature || '这个人很懒，什么都没写' }}</div>
      </div>
      <div class="profile-stats">
        <div class="stat-item" @click="router.push('/profile/' + profile.id)">
          <div class="stat-num">{{ profile.postCount }}</div>
          <div class="stat-label">动态</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">{{ profile.followerCount }}</div>
          <div class="stat-label">粉丝</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">{{ profile.followingCount }}</div>
          <div class="stat-label">关注</div>
        </div>
      </div>
      <van-button
        v-if="isOwner"
        size="small"
        plain
        round
        color="#07C160"
        class="edit-btn"
        @click="showEdit = true"
      >
        编辑资料
      </van-button>
      <!-- 非本人：关注/已关注按钮 -->
      <van-button
        v-else-if="userStore.isLoggedIn && profile.id"
        size="small"
        :plain="isFollowing"
        round
        :color="isFollowing ? '#999' : '#07C160'"
        class="edit-btn"
        :loading="followLoading"
        @click="handleToggleFollow"
      >
        {{ isFollowing ? '已关注' : '+ 关注' }}
      </van-button>
    </div>

    <!-- 快捷入口：收藏与历史、暗黑模式（仅本人可见） -->
    <div v-if="isOwner" class="quick-entry">
      <div class="entry-item" @click="router.push('/favorites')">
        <van-icon name="star-o" size="20" color="#07C160" />
        <span>收藏与历史</span>
        <van-icon name="arrow" size="14" color="#c8c9cc" class="arrow" />
      </div>
      <div class="entry-item">
        <van-icon name="bulb-o" size="20" color="#07C160" />
        <span>暗黑模式</span>
        <van-switch :model-value="isDark" size="20px" class="arrow" @change="toggleTheme" />
      </div>
    </div>

    <div class="profile-posts">
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list
          v-model:loading="loading"
          :finished="finished"
          finished-text="没有更多了"
          @load="onLoad"
        >
          <PostCard v-for="item in posts" :key="item.id" :post="item" @comment="handleComment" />
          <van-empty v-if="posts.length === 0 && !loading" description="暂无动态" />
        </van-list>
      </van-pull-refresh>
    </div>

    <van-popup v-model:show="showEdit" position="bottom" round :style="{ height: '60vh' }">
      <div class="edit-popup">
        <div class="edit-header">
          <span>编辑资料</span>
          <van-icon name="cross" @click="showEdit = false" />
        </div>
        <van-form @submit="handleEdit">
          <van-cell-group inset>
            <div class="avatar-edit-row">
              <span class="avatar-edit-label">头像</span>
              <van-uploader
                v-model="avatarFile"
                :max-count="1"
                :max-size="5 * 1024 * 1024"
                :before-read="beforeAvatarRead"
                :after-read="afterAvatarRead"
                preview-size="48"
                :preview-image="true"
                :deletable="false"
                accept="image/*"
              >
                <van-image round width="48" height="48" :src="editForm.avatar || profile.avatar" />
                <div class="avatar-upload-hint">点击更换</div>
              </van-uploader>
            </div>
            <van-field
              v-model="editForm.nickname"
              label="昵称"
              placeholder="请输入昵称"
              maxlength="20"
              :rules="[{ required: true, message: '请输入昵称' }]"
            />
            <van-field
              v-model="editForm.signature"
              label="个性签名"
              placeholder="请输入个性签名"
              maxlength="50"
            />
          </van-cell-group>
          <div style="margin: 16px">
            <van-button round block type="primary" native-type="submit" color="#07C160">
              保存
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useUserStore } from '@/stores/user'
import { useTheme } from '@/utils/theme'
import { getUserInfo, getMe, updateUserInfo, followUser, unfollowUser } from '@/api/user'
import { getUserPosts } from '@/api/post'
import { uploadImages } from '@/api/upload'
import { compressImage } from '@/utils/compress'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const { isDark, toggleTheme } = useTheme()

const profile = ref({
  id: 0,
  nickname: '',
  avatar: '',
  signature: '',
  postCount: 0,
  followerCount: 0,
  followingCount: 0
})

const posts = ref([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const postPage = ref(1)

// 竞态保护：每次加载递增版本号，回调时校验版本是否匹配
let loadVersion = 0
// 防止 loadProfile 和 van-list 的 onLoad 重复触发首屏加载
let profileReady = false

const showEdit = ref(false)
const editForm = ref({ nickname: '', signature: '', avatar: '' })
const avatarFile = ref([])
// 关注状态
const isFollowing = ref(false)
const followLoading = ref(false)

const isOwner = computed(() => {
  return userStore.userInfo?.id === profile.value.id
})

onMounted(async () => {
  await loadProfile()
})

// 路由参数变化时重新加载（/profile/1 -> /profile/2）
watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      resetAndLoad()
    }
  }
)

function resetAndLoad() {
  posts.value = []
  postPage.value = 1
  finished.value = false
  loading.value = false
  profileReady = false
  loadProfile()
}

async function loadProfile() {
  const currentVersion = ++loadVersion
  try {
    let userId = route.params.id
    // 刷新后 userInfo 为 null，且路由没有 id 时，用 /users/me 拿当前用户
    if (!userId && !userStore.userInfo) {
      const me = await getMe()
      // 竞态校验：如果期间又切换了用户，放弃本次结果
      if (currentVersion !== loadVersion) return
      userStore.setUserInfo(me)
      userId = me.id
    }
    if (!userId) {
      userId = userStore.userInfo?.id
    }
    if (!userId) {
      showToast({ type: 'fail', message: '加载失败' })
      return
    }
    const res = await getUserInfo(userId)
    // 竞态校验
    if (currentVersion !== loadVersion) return
    profile.value = res.user || res
    if (!profile.value || !profile.value.id) {
      showToast({ type: 'fail', message: '加载失败' })
      return
    }
    // 同步关注状态
    isFollowing.value = !!res.isFollowing
    editForm.value = {
      nickname: profile.value.nickname,
      signature: profile.value.signature,
      avatar: profile.value.avatar || ''
    }
    // profile 就绪，允许 onLoad 加载文章列表
    profileReady = true
    // 手动触发首屏加载（van-list 挂载时 profile.id 还是 0 被跳过）
    if (posts.value.length === 0 && !finished.value && !loading.value) {
      onLoad()
    }
  } catch (e) {
    if (currentVersion !== loadVersion) return
    showToast({ type: 'fail', message: '加载失败' })
  }
}

async function onLoad() {
  // 等 profile 加载完成（van-list 挂载时 profile.id 还是 0）
  if (!profileReady || !profile.value.id) {
    loading.value = false
    return
  }
  // 防止与 loadProfile 的手动触发重复
  if (loading.value) return
  loading.value = true
  try {
    const res = await getUserPosts(profile.value.id, {
      page: postPage.value,
      pageSize: 10
    })
    if (!res.list || res.list.length < 10) {
      finished.value = true
    }
    // 适配 PostCard 需要的 user 嵌套结构
    const items = (res.list || []).map((p) => ({
      ...p,
      user: {
        id: p.userId,
        nickname: p.nickname,
        avatar: p.avatar
      }
    }))
    posts.value.push(...items)
    postPage.value++
  } catch (e) {
    finished.value = true
    showToast({ type: 'fail', message: '加载失败' })
  } finally {
    loading.value = false
  }
}

async function onRefresh() {
  posts.value = []
  postPage.value = 1
  finished.value = false
  loading.value = false
  refreshing.value = false
  await onLoad()
}

function beforeAvatarRead(file) {
  if (file.size > 5 * 1024 * 1024) {
    showToast({ type: 'fail', message: '图片不能超过5MB' })
    return false
  }
  return true
}

async function afterAvatarRead(file) {
  try {
    const compressed = await compressImage(file.file, 400, 5 * 1024 * 1024)
    const res = await uploadImages([compressed])
    if (res.urls && res.urls.length > 0) {
      editForm.value.avatar = res.urls[0]
      showToast({ type: 'success', message: '头像已上传' })
    } else {
      showToast({ type: 'fail', message: '上传失败' })
    }
  } catch (e) {
    showToast({ type: 'fail', message: '头像上传失败' })
  }
}

async function handleEdit() {
  try {
    const payload = {
      nickname: editForm.value.nickname,
      signature: editForm.value.signature
    }
    if (editForm.value.avatar && editForm.value.avatar.trim()) {
      payload.avatar = editForm.value.avatar.trim()
    }
    await updateUserInfo(payload)
    profile.value.nickname = editForm.value.nickname
    profile.value.signature = editForm.value.signature
    if (editForm.value.avatar && editForm.value.avatar.trim()) {
      profile.value.avatar = editForm.value.avatar.trim()
    }
    userStore.setUserInfo({ ...userStore.userInfo, ...payload })
    showEdit.value = false
    showToast({ type: 'success', message: '保存成功' })
  } catch (e) {
    showToast({ type: 'fail', message: '保存失败' })
  }
}

function handleComment(_post) {}

// 关注 / 取消关注（乐观更新 + 失败回滚）
async function handleToggleFollow() {
  if (followLoading.value) return
  followLoading.value = true
  const prev = isFollowing.value
  isFollowing.value = !prev
  // 同步乐观更新粉丝数
  profile.value.followerCount = Math.max(
    0,
    (profile.value.followerCount || 0) + (isFollowing.value ? 1 : -1)
  )
  try {
    if (isFollowing.value) {
      await followUser(profile.value.id)
      showToast({ type: 'success', message: '已关注' })
    } else {
      await unfollowUser(profile.value.id)
      showToast({ type: 'success', message: '已取消关注' })
    }
  } catch (e) {
    // 回滚
    isFollowing.value = prev
    profile.value.followerCount = Math.max(0, (profile.value.followerCount || 0) + (prev ? 1 : -1))
    showToast({ type: 'fail', message: '操作失败' })
  } finally {
    followLoading.value = false
  }
}
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: #fff;
}

.profile-header {
  position: relative;
  padding-bottom: 16px;
}

.profile-bg {
  height: 120px;
  background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
}

.profile-info {
  text-align: center;
  margin-top: -32px;
}

.profile-avatar {
  border: 3px solid #fff;
  border-radius: 50%;
}

.profile-nickname {
  font-size: 18px;
  font-weight: 600;
  margin-top: 8px;
}

.profile-signature {
  font-size: 13px;
  color: #999;
  margin-top: 4px;
}

.profile-stats {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-top: 16px;
}

.stat-item {
  text-align: center;
}

.stat-num {
  font-size: 18px;
  font-weight: 600;
}

.stat-label {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.edit-btn {
  display: block;
  margin: 12px auto 0;
}

.quick-entry {
  border-top: 8px solid #f5f5f5;
  border-bottom: 8px solid #f5f5f5;
}

.entry-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  font-size: 15px;
  color: #333;
  cursor: pointer;
  background: #fff;
}

.entry-item:active {
  background: #fafafa;
}

.entry-item .arrow {
  margin-left: auto;
}

.profile-posts {
  border-top: 8px solid #f5f5f5;
}

.edit-popup {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  font-size: 16px;
  font-weight: 500;
  border-bottom: 1px solid #f0f0f0;
}

.avatar-edit-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
}

.avatar-edit-label {
  width: 56px;
  font-size: 14px;
  color: #333;
  flex-shrink: 0;
}

.avatar-upload-hint {
  font-size: 12px;
  color: #576b95;
  text-align: center;
  margin-top: 4px;
}

.avatar-wrapper {
  position: relative;
  display: inline-block;
  cursor: pointer;
}

.avatar-edit-mask {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
