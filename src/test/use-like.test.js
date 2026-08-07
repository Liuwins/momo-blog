import { describe, it, expect, vi } from 'vitest'
import { useLike } from '@/composables/useLike'

vi.mock('@/api/post', () => ({
  toggleLike: vi.fn()
}))

describe('useLike', () => {
  it('should toggle like state on success', async () => {
    const { toggleLike } = await import('@/api/post')
    toggleLike.mockResolvedValue({ liked: true, likeCount: 1 })

    const { handleToggle } = useLike()
    const liked = { value: false }
    const count = { value: 0 }

    await handleToggle(1, liked, count)

    expect(liked.value).toBe(true)
    expect(count.value).toBe(1)
  })

  it('should revert on failure', async () => {
    const { toggleLike } = await import('@/api/post')
    toggleLike.mockRejectedValue(new Error('Network error'))

    const { handleToggle } = useLike()
    const liked = { value: false }
    const count = { value: 5 }

    await handleToggle(1, liked, count)

    expect(liked.value).toBe(false)
    expect(count.value).toBe(5)
  })
})
