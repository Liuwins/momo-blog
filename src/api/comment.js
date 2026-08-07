import request from './request'

export function getComments(postId) {
  return request.get(`/posts/${postId}/comments`)
}

export function createComment(data) {
  return request.post('/comments', data)
}

export function deleteComment(id) {
  return request.delete(`/comments/${id}`)
}
