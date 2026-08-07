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
        <div class="upload-tip">最多9张，单张不超过5MB</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { createPost, getPostDetail, updatePost } from '@/api/post'
import { uploadImages } from '@/api/upload'
import { compressImage } from '@/utils/compress'

const router = useRouter()
const route = useRoute()
const content = ref('')
const fileList = ref([])
const fieldRef = ref(null)
const uploading = ref(false)

const isEdit = computed(() => !!route.query.edit)
const postId = computed(() => Number(route.query.edit))

const canPublish = computed(() => content.value.trim() || fileList.value.length > 0)

onMounted(async () => {
  setTimeout(() => {
    fieldRef.value?.focus()
  }, 300)

  // 编辑模式：加载旧内容
  if (isEdit.value) {
    try {
      const res = await getPostDetail(postId.value)
      content.value = res.post.content || ''
      const imgs = res.post.images || []
      fileList.value = imgs.map((url) => ({ url, status: 'done', serverUrl: url, isImage: true }))
    } catch (e) {
      showToast({ type: 'fail', message: '加载失败' })
    }
  }
})

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
    // 收集已上传的图片 URL（编辑时新旧合并）
    const images = fileList.value
      .filter((item) => item.status === 'done' && item.serverUrl)
      .map((item) => item.serverUrl)

    if (isEdit.value) {
      await updatePost(postId.value, { content: content.value, images })
      showToast({ type: 'success', message: '保存成功' })
    } else {
      await createPost({ content: content.value, images })
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
</style>