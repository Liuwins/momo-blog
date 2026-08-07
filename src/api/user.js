import request from './request'

export function login(data) {
  return request.post('/auth/login', data)
}

export function getUserInfo(id) {
  return request.get(`/users/${id}`)
}

export function getMe() {
  return request.get('/users/me')
}

export function updateUserInfo(data) {
  return request.put('/users/profile', data)
}
