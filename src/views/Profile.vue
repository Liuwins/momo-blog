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
        <van-image v-else round width="64" height="64" :src="profile.avatar" class="profile-avatar" />
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
    </div>

    <div class="profile-posts">
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list
          v-model:loading="loading"
          :finished="finished"
          finished-text="没有更多了"
          @load="onLoad"
        >
          <PostCard
            v-for="item in posts"
            :key="item.id"
            :post="item"
            @comment="handleComment"
          />
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
              <van-image round width="48" height="48" :src="editForm.avatar || profile.avatar" />
              <van-field
                v-model="editForm.avatar"
                placeholder="粘贴图片 URL"
                class="avatar-edit-input"
              />
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
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useUserStore } from '@/stores/user'
import { getUserInfo, getMe, updateUserInfo } from '@/api/user'
import { getUserPosts } from '@/api/post'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

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

const showEdit = ref(false)
const editForm = ref({ nickname: '', signature: '', avatar: '' })

const isOwner = computed(() => {
  return userStore.userInfo?.id === profile.value.id
})

onMounted(async () => {
  await loadProfile()
})

async function loadProfile() {
  try {
    let userId = route.params.id
    // 刷新后 userInfo 为 null，且路由没有 id 时，用 /users/me 拿当前用户
    if (!userId && !userStore.userInfo) {
      const me = await getMe()
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
    profile.value = res.user || res
    if (!profile.value || !profile.value.id) {
      showToast({ type: 'fail', message: '加载失败' })
      return
    }
    editForm.value = {
      nickname: profile.value.nickname,
      signature: profile.value.signature,
      avatar: profile.value.avatar || ''
    }
    // profile 就绪后触发文章列表加载（van-list 挂载时 id 还是 0 被跳过）
    if (posts.value.length === 0 && !finished.value) {
      await onLoad()
    }
  } catch (e) {
    showToast({ type: 'fail', message: '加载失败' })
  }
}

async function onLoad() {
  // 等 profile 加载完成（van-list 挂载时 profile.id 还是 0）
  if (!profile.value.id) {
    loading.value = false
    return
  }
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
        avatar: p.avatar,
      },
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

async function handleEdit() {
  try {
    const payload = {
      nickname: editForm.value.nickname,
      signature: editForm.value.signature
    }
    if (editForm.value.avatar) {
      payload.avatar = editForm.value.avatar
    }
    await updateUserInfo(payload)
    profile.value.nickname = editForm.value.nickname
    profile.value.signature = editForm.value.signature
    if (editForm.value.avatar) {
      profile.value.avatar = editForm.value.avatar
    }
    userStore.setUserInfo({ ...userStore.userInfo, ...editForm.value })
    showEdit.value = false
    showToast({ type: 'success', message: '保存成功' })
  } catch (e) {
    showToast({ type: 'fail', message: '保存失败' })
  }
}

function handleComment(_post) {
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
  background: linear-gradient(135deg, #07C160 0%, #06AD56 100%);
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
}

.avatar-edit-input {
  flex: 1;
  padding: 0;
}

.avatar-edit-input :deep(.van-field__control) {
  font-size: 12px;
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
