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
        <span :class="['publish-btn', { disabled: !canPublish }]">{{ isEdit ? '保存' : '发布' }}</span>
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
        />
        <div class="upload-tip">最多9张，单张不超过5MB（自动压缩为多尺寸）</div>
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
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { createPost, getPostDetail, updatePost, getTags } from '@/api/post'
import { uploadImages } from '@/api/upload'
import { compressImage } from '@/utils/compress'

const router = useRouter()
const route = useRoute()
const content = ref('')
const fileList = ref([])
const fieldRef = ref(null)
const uploading = ref(false)
const selectedTags = ref([])
const customTag = ref('')
const existingTags = ref([])

const isEdit = computed(() => !!route.query.edit)
const postId = computed(() => Number(route.query.edit))

const canPublish = computed(() => content.value.trim() || fileList.value.length > 0)

onMounted(async () => {
  setTimeout(() => {
    fieldRef.value?.focus()
  }, 300)

  // 加载已有标签
  try {
    const tags = await getTags()
    existingTags.value = tags || []
  } catch (e) { /* 忽略 */ }

  // 编辑模式：加载旧内容
  if (isEdit.value) {
    try {
      const res = await getPostDetail(postId.value)
      content.value = res.content || ''
      const imgs = res.images || []
      fileList.value = imgs.map((url) => ({ url, status: 'done', serverUrl: url, isImage: true }))
      selectedTags.value = res.tags || []
    } catch (e) {
      showToast({ type: 'fail', message: '加载失败' })
    }
  }
})

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

function handleCancel() {
  if (content.value.trim() || fileList.value.length > 0) {
    showConfirmDialog({
      message: '确定放弃吗？'
    }).then(() => {
      router.back()
    }).catch(() => {})
  } else {
    router.back()
  }
}

async function handlePublish() {
  if (!canPublish.value || uploading.value) return
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

    const payload = {
      content: content.value,
      images,
      tags: selectedTags.value,
    }

    if (isEdit.value) {
      await updatePost(postId.value, payload)
      showToast({ type: 'success', message: '保存成功' })
    } else {
      await createPost(payload)
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
  color: #07C160;
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
