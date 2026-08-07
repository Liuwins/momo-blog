import { showToast } from 'vant'
import { toggleLike } from '@/api/post'

export function useLike() {
  async function handleToggle(postId, liked, likeCount) {
    const previous = { liked: liked.value, count: likeCount.value }
    liked.value = !liked.value
    likeCount.value += liked.value ? 1 : -1
    try {
      await toggleLike(postId)
    } catch (e) {
      liked.value = previous.liked
      likeCount.value = previous.count
      showToast({ type: 'fail', message: '操作失败，请重试' })
    }
  }

  return { handleToggle }
}
