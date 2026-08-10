<template>
  <div class="publish-page">
    <van-nav-bar
      :title="isEdit ? '编辑动态' : '发布动态'"
      left-text="取消"
      right-text="发布"
      left-arrow
      @click-left="handleCancel"
      @click-right="handlePublish"
    >
      <template #right>
        <span :class="['publish-btn', { disabled: !canPublish }]">{{
          isEdit ? '保存' : '发布'
        }}</span>
      </template>
    </van-nav-bar>

    <div class="publish-body">
      <van-field
        ref="fieldRef"
        v-model="content"
        type="textarea"
        placeholder="分享你的想法..."
        :autosize="{ minHeight: 120, maxHeight: 300 }"
        maxlength="2000"
        show-word-limit
      />

      <div class="upload-section">
        <van-uploader
          v-model="fileList"
          :max-count="9"
          :max-size="5 * 1024 * 1024"
          :before-read="beforeRead"
          :after-read="afterRead"
          upload-icon="photograph"
          deletable
          preview-size="80px"
          multiple
          accept="image/*"
        />
        <div class="upload-tip">图片最多9张，单张不超过5MB（自动压缩为多尺寸）</div>
      </div>

      <!-- 视频上传（独立区域，限1个，50MB） -->
      <div class="upload-section">
        <div class="video-label">
          视频 <span class="tags-hint">（选填，最多1个，50MB以内）</span>
        </div>
        <van-uploader
          v-model="videoList"
          :max-count="1"
          :max-size="50 * 1024 * 1024"
          :before-read="beforeVideoRead"
          :after-read="afterVideoRead"
          upload-icon="video-o"
          deletable
          preview-size="120px"
          accept="video/mp4,video/webm"
        >
          <template #preview-cover="{ item }">
            <div class="video-preview-cover">
              <video
                v-if="item.url || item.serverUrl"
                :src="item.url || item.serverUrl"
                preload="metadata"
                muted
                class="cover-video"
              />
              <div v-else class="cover-placeholder">
                <van-icon name="video-o" size="28" color="#c8c9cc" />
              </div>
              <van-icon
                v-if="item.status === 'uploading'"
                name="loading"
                size="20"
                color="#fff"
                class="cover-loading"
              />
            </div>
          </template>
        </van-uploader>
        <div class="upload-tip">支持 mp4 / webm，单个不超过50MB</div>
      </div>

      <!-- 标签选择 -->
      <div class="tags-section">
        <div class="tags-label">标签 <span class="tags-hint">（选填，最多5个）</span></div>
        <div v-if="selectedTags.length" class="selected-tags">
          <van-tag
            v-for="tag in selectedTags"
            :key="tag"
            closeable
            type="primary"
            round
            size="medium"
            class="tag-item"
            @close="toggleTag(tag)"
          >
            {{ tag }}
          </van-tag>
        </div>
        <div v-if="existingTags.length" class="tags-wrap">
          <van-tag
            v-for="tag in existingTags"
            :key="tag.name"
            :type="selectedTags.includes(tag.name) ? 'primary' : 'default'"
            round
            plain
            size="medium"
            class="tag-item"
            @click="toggleTag(tag.name)"
          >
            {{ tag.name }}
          </van-tag>
        </div>
        <div class="custom-tag-input">
          <van-field
            v-model="customTag"
            placeholder="输入标签文字，按回车或点添加"
            maxlength="10"
            @keypress.enter.prevent="addCustomTag"
          >
            <template #button>
              <van-button size="small" plain type="primary" @click="addCustomTag">添加</van-button>
            </template>
          </van-field>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { createPost, getPostDetail, updatePost, getTags } from '@/api/post'
import { uploadImages, uploadVideo } from '@/api/upload'
import { compressImage } from '@/utils/compress'
import { getDraft, saveDraft, clearDraft } from '@/utils/storage'

const router = useRouter()
const route = useRoute()
const content = ref('')
const fileList = ref([])
const videoList = ref([])
const fieldRef = ref(null)
const uploading = ref(false)
const selectedTags = ref([])
const customTag = ref('')
const existingTags = ref([])

const isEdit = computed(() => !!route.query.edit)
const postId = computed(() => Number(route.query.edit))

const canPublish = computed(
  () => content.value.trim() || fileList.value.length > 0 || videoList.value.length > 0
)

let focusTimer = null
let draftTimer = null

onMounted(async () => {
  focusTimer = setTimeout(() => {
    fieldRef.value?.focus()
  }, 300)

  // 加载已有标签
  try {
    const tags = await getTags()
    existingTags.value = tags || []
  } catch (e) {
    /* 忽略 */
  }

  // 非编辑模式：检测是否有未提交草稿，提示恢复
  if (!isEdit.value) {
    const draft = getDraft()
    if (draft && (draft.content || (draft.images && draft.images.length))) {
      try {
        await showConfirmDialog({
          title: '恢复草稿',
          message: `检测到未提交的草稿（${new Date(draft.savedAt).toLocaleString()}），是否恢复？`
        })
        content.value = draft.content || ''
        selectedTags.value = draft.tags || []
        if (draft.images && draft.images.length) {
          fileList.value = draft.images.map((url) => ({
            url,
            status: 'done',
            serverUrl: url,
            isImage: true
          }))
        }
        if (draft.videos && draft.videos.length) {
          videoList.value = draft.videos.map((url) => ({
            url,
            status: 'done',
            serverUrl: url,
            isVideo: true
          }))
        }
        showToast({ type: 'success', message: '草稿已恢复' })
      } catch {
        // 用户选择不恢复，清掉旧草稿
        clearDraft()
      }
    }
  }

  // 编辑模式：加载旧内容
  if (isEdit.value) {
    try {
      const res = await getPostDetail(postId.value)
      content.value = res.content || ''
      const imgs = res.images || []
      fileList.value = imgs.map((url) => ({ url, status: 'done', serverUrl: url, isImage: true }))
      // 加载已有视频
      const vids = res.videos || []
      videoList.value = vids.map((url) => ({ url, status: 'done', serverUrl: url, isVideo: true }))
      selectedTags.value = res.tags || []
    } catch (e) {
      showToast({ type: 'fail', message: '加载失败' })
    }
  }
})

// 组件卸载时清理定时器，防止内存泄漏
onUnmounted(() => {
  if (focusTimer) {
    clearTimeout(focusTimer)
    focusTimer = null
  }
  if (draftTimer) {
    clearTimeout(draftTimer)
    draftTimer = null
  }
})

// 草稿自动保存：内容变化时防抖 1 秒存入本地（仅新建模式，编辑模式不打扰）
watch(
  [content, fileList, videoList, selectedTags],
  () => {
    if (isEdit.value) return
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      const images = fileList.value
        .filter((item) => item.status === 'done' && item.serverUrl)
        .map((item) => item.serverUrl)
      const videos = videoList.value
        .filter((item) => item.status === 'done' && item.serverUrl)
        .map((item) => item.serverUrl)
      // 只在有实际内容时保存
      if (content.value.trim() || images.length || videos.length) {
        saveDraft({ content: content.value, images, videos, tags: selectedTags.value })
      }
    }, 1000)
  },
  { deep: true }
)

function toggleTag(tag) {
  const idx = selectedTags.value.indexOf(tag)
  if (idx !== -1) {
    selectedTags.value.splice(idx, 1)
  } else {
    if (selectedTags.value.length >= 5) {
      showToast({ type: 'warning', message: '最多选 5 个标签' })
      return
    }
    selectedTags.value.push(tag)
  }
}

function addCustomTag() {
  const tag = customTag.value.trim()
  if (!tag) return
  if (selectedTags.value.includes(tag)) {
    showToast({ type: 'warning', message: '标签已存在' })
    return
  }
  if (selectedTags.value.length >= 5) {
    showToast({ type: 'warning', message: '最多选 5 个标签' })
    return
  }
  selectedTags.value.push(tag)
  // 如果已有标签列表里没有，加进去
  if (!existingTags.value.find((t) => t.name === tag)) {
    existingTags.value.push({ name: tag, count: 0 })
  }
  customTag.value = ''
}

function beforeRead(file) {
  if (file.size > 5 * 1024 * 1024) {
    showToast({ type: 'fail', message: '图片大小不能超过5MB' })
    return false
  }
  return true
}

async function afterRead(file) {
  try {
    const compressed = await compressImage(file.file, 1200, 5 * 1024 * 1024)
    const res = await uploadImages([compressed])
    if (res.urls && res.urls.length > 0) {
      file.serverUrl = res.urls[0]
      file.status = 'done'
    } else {
      file.status = 'failed'
      showToast({ type: 'fail', message: '上传失败' })
    }
  } catch (e) {
    file.status = 'failed'
    showToast({ type: 'fail', message: '图片上传失败' })
  }
}

// 视频校验：类型 + 大小
function beforeVideoRead(file) {
  const allowedTypes = ['video/mp4', 'video/webm']
  if (!allowedTypes.includes(file.type)) {
    showToast({ type: 'fail', message: '仅支持 mp4 / webm 格式' })
    return false
  }
  if (file.size > 50 * 1024 * 1024) {
    showToast({ type: 'fail', message: '视频不能超过50MB' })
    return false
  }
  return true
}

// 视频上传：不压缩，直接上传原文件
async function afterVideoRead(file) {
  file.status = 'uploading'
  try {
    const res = await uploadVideo(file.file)
    if (res.url) {
      file.serverUrl = res.url
      file.url = res.url
      file.status = 'done'
    } else {
      file.status = 'failed'
      showToast({ type: 'fail', message: '视频上传失败' })
    }
  } catch (e) {
    file.status = 'failed'
    showToast({ type: 'fail', message: '视频上传失败' })
  }
}

function handleCancel() {
  if (content.value.trim() || fileList.value.length > 0 || videoList.value.length > 0) {
    showConfirmDialog({
      message: '确定放弃吗？'
    })
      .then(() => {
        router.back()
      })
      .catch(() => {})
  } else {
    router.back()
  }
}

async function handlePublish() {
  if (!canPublish.value || uploading.value) return
  // 拦截未上传完成的视频
  const uploadingVideo = videoList.value.find((v) => v.status === 'uploading')
  if (uploadingVideo) {
    showToast({ type: 'warning', message: '视频上传中，请稍候' })
    return
  }
  uploading.value = true
  try {
    // 如果输入框有未添加的标签，自动加入
    if (customTag.value.trim()) {
      addCustomTag()
    }
    // 收集已上传的图片 URL（编辑时新旧合并）
    const images = fileList.value
      .filter((item) => item.status === 'done' && item.serverUrl)
      .map((item) => item.serverUrl)

    // 收集已上传的视频 URL
    const videos = videoList.value
      .filter((item) => item.status === 'done' && item.serverUrl)
      .map((item) => item.serverUrl)

    const payload = {
      content: content.value,
      images,
      videos,
      tags: selectedTags.value
    }

    if (isEdit.value) {
      await updatePost(postId.value, payload)
      showToast({ type: 'success', message: '保存成功' })
    } else {
      await createPost(payload)
      // 发布成功，清掉草稿
      clearDraft()
      showToast({ type: 'success', message: '发布成功' })
    }
    router.back()
  } catch (e) {
    showToast({ type: 'fail', message: isEdit.value ? '保存失败' : '发布失败' })
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.publish-page {
  min-height: 100vh;
  background: #fff;
}

.publish-btn {
  color: #07c160;
  font-size: 15px;
  font-weight: 500;
}

.publish-btn.disabled {
  color: #ccc;
}

.publish-body {
  padding: 12px 16px;
}

.upload-section {
  margin-top: 16px;
}

.upload-tip {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}

.video-label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 10px;
}

.video-preview-cover {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
}

.cover-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f7f8fa;
}

.cover-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.tags-section {
  margin-top: 20px;
}

.tags-label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 10px;
}

.tags-hint {
  font-size: 12px;
  font-weight: 400;
  color: #999;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  padding: 8px 10px;
  background: #f0f4fa;
  border-radius: 8px;
}

.tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.tag-item {
  cursor: pointer;
}

.custom-tag-input {
  margin-bottom: 12px;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.selected-label {
  font-size: 13px;
  color: #999;
}
</style>
