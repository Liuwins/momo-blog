import axios from 'axios'
import { showToast } from 'vant'
import router from '@/router'

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

    // 后端直接返回数据对象（无包装）
    if (res && typeof res === 'object') {
      // 以下字段视为有效响应，直接放行
      const passKeys = ['list', 'token', 'id', 'urls', 'liked', 'comment', 'post', 'user', 'message', 'total']
      if (passKeys.some((k) => k in res)) {
        return res
      }
    }

    // 兼容旧格式
    if (res && res.code === 200) {
      return res.data
    }
    if (res && res.code === 401) {
      localStorage.removeItem('token')
      // 带上当前页面路径，登录后跳回
      router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
      toast('fail', '登录已过期，请重新登录')
    } else if (res && res.code === 403) {
      toast('fail', '请先登录')
      setTimeout(() => {
        router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
      }, 1000)
    } else if (res && res.message) {
      toast('fail', res.message)
    } else {
      toast('fail', '请求失败')
    }
    return Promise.reject(new Error(res?.message || 'Request Error'))
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      // 带上当前页面路径，登录后跳回
      router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
      toast('fail', '登录已过期，请重新登录')
    } else if (error.response?.status === 403) {
      // 未登录操作（点赞/评论/发布）→ 跳登录
      toast('fail', '请先登录')
      setTimeout(() => {
        router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
      }, 1000)
    } else {
      toast('fail', '网络异常，请检查网络连接')
    }
    return Promise.reject(error)
  }
)

export default request
