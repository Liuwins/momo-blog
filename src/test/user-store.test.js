import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUserStore } from '@/stores/user'

vi.mock('@/api/user', () => ({
  login: vi.fn(),
  register: vi.fn(),
  getUserInfo: vi.fn()
}))

describe('useUserStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('should start logged out', () => {
    const store = useUserStore()
    expect(store.isLoggedIn).toBe(false)
  })

  it('should set token on login', async () => {
    const { login } = await import('@/api/user')
    login.mockResolvedValue({ token: 'test-token', user: { id: 1, nickname: 'Test' } })

    const store = useUserStore()
    await store.loginAction('13800138000', '123456')

    expect(store.isLoggedIn).toBe(true)
    expect(store.token).toBe('test-token')
    expect(store.userInfo.nickname).toBe('Test')
    expect(localStorage.getItem('token')).toBe('test-token')
  })

  it('should clear token on logout', () => {
    const store = useUserStore()
    localStorage.setItem('token', 'some-token')
    localStorage.setItem('token_expires', String(Date.now() + 100000))
    store.logout()

    expect(store.isLoggedIn).toBe(false)
    expect(store.token).toBe('')
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('should be logged out when token expired', () => {
    localStorage.setItem('token', 'expired-token')
    localStorage.setItem('token_expires', String(Date.now() - 1000))

    const store = useUserStore()
    expect(store.isLoggedIn).toBe(false)
  })
})
