import request from './request'

export function getPosts(params) {
  return request.get('/posts', { params })
}

export function getPostDetail(id) {
  return request.get(`/posts/${id}`)
}

export function createPost(data) {
  return request.post('/posts', data)
}

export function updatePost(id, data) {
  return request.put(`/posts/${id}`, data)
}

export function deletePost(id) {
  return request.delete(`/posts/${id}`)
}

export function getUserPosts(userId, params) {
  return request.get(`/users/${userId}/posts`, { params })
}

export function toggleLike(postId) {
  return request.post(`/posts/${postId}/like`)
}

export function getTags() {
  return request.get('/posts/tags')
}
