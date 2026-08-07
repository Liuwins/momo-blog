import request from './request'

export function uploadImages(files) {
  const formData = new FormData()
  files.forEach((file) => {
    formData.append('files', file)
  })
  // 不要手动设置 Content-Type！axios 会自动生成正确的 multipart boundary
  return request.post('/upload', formData, {
    timeout: 60000
  })
}