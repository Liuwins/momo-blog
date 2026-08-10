import axios from 'axios'
import { showToast } from 'vant'
import router from '@/router'
import { useUserStore } from '@/stores/user'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// 全局 toast 去重 + 样式优化
let lastToastMsg = ''
let lastToastTime = 0

function toast(type, message) {
  const now = Date.now()
  // 同一消息 1.5s 内不重复弹
  if (message === lastToastMsg && now - lastToastTime < 1500) return
  lastToastMsg = message
  lastToastTime = now
  // 仿大厂样式：带图标、居中、2.5s，使用专属过渡类（不动 popup 的 van-fade）
  const iconMap = {
    success: 'success',
    fail: 'cross',
    warning: 'warning-o',
    loading: 'loading'
  }
  showToast({
    type: 'text',
    icon: iconMap[type] || '',
    message,
    duration: 2500,
    position: 'center',
    transition: 'van-toast-fade',
    className: `custom-toast custom-toast--${type}`
  })
}

// 防止 401/403 时重复跳转登录页
let isRedirecting = false

function redirectToLogin() {
  if (isRedirecting) return
  isRedirecting = true
  const redirect = router.currentRoute.value.fullPath
  router.push({ path: '/login', query: { redirect } }).finally(() => {
    isRedirecting = false
  })
}

// 延迟获取 user store 实例（避免 Pinia 初始化顺序问题）
let userStoreInstance = null
function getUserStore() {
  if (!userStoreInstance) {
    try {
      userStoreInstance = useUserStore()
    } catch (e) {
      return null
    }
  }
  return userStoreInstance
}

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response) => {
    const res = response.data

    // 直接放行 success/boolean（如删除返回 true）
    if (res === true || res === false || res === 'success') {
      return res
    }

    // 数组直接放行（标签列表等）
    if (Array.isArray(res)) {
      return res
    }

    // 数字/字符串直接放行（如未读数、待审核数）
    if (typeof res === 'number' || typeof res === 'string') {
      return res
    }

    // 后端直接返回数据对象（无包装）
    if (res && typeof res === 'object') {
      // 以下字段视为有效响应，直接放行
      const passKeys = [
        'list',
        'token',
        'id',
        'urls',
        'liked',
        'comment',
        'post',
        'user',
        'message',
        'total'
      ]
      if (passKeys.some((k) => k in res)) {
        return res
      }
    }

    // 兼容旧格式
    if (res && res.code === 200) {
      return res.data
    }
    if (res && res.code === 401) {
      handleAuthError('登录已过期，请重新登录')
    } else if (res && res.code === 403) {
      handleAuthError('请先登录')
    } else if (res && res.message) {
      toast('fail', res.message)
    } else {
      toast('fail', '请求失败')
    }
    return Promise.reject(new Error(res?.message || 'Request Error'))
  },
  (error) => {
    if (error.response?.status === 401) {
      handleAuthError('登录已过期，请重新登录')
    } else if (error.response?.status === 403) {
      handleAuthError('请先登录')
    } else {
      toast('fail', '网络异常，请检查网络连接')
    }
    return Promise.reject(error)
  }
)

/**
 * 统一处理认证失败：清空 store + localStorage，跳转登录页
 */
function handleAuthError(message) {
  try {
    // 同步清理 user store 状态（避免 UI 与实际登录态不一致）
    const store = getUserStore()
    if (store) store.logout()
  } catch (e) {
    // 降级：直接清 localStorage
    localStorage.removeItem('token')
    localStorage.removeItem('token_expires')
    localStorage.removeItem('user_info')
  }
  toast('fail', message)
  redirectToLogin()
}

export default request
