export function compressImage(file, maxWidth = 800, maxSize = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    if (file.size <= maxSize) {
      resolve(file)
      return
    }

    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        if (width > maxWidth) {
          height = (maxWidth / width) * height
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob((blob) => {
          if (blob.size <= maxSize) {
            resolve(new File([blob], file.name, { type: file.type }))
          } else {
            const quality = maxSize / blob.size
            canvas.toBlob((blob2) => {
              resolve(new File([blob2], file.name, { type: file.type }))
            }, file.type, quality)
          }
        }, file.type, 0.9)
      }
    }
    reader.onerror = reject
  })
}
