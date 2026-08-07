import { showToast } from 'vant'

export function installErrorHandler(app) {
  app.config.errorHandler = (err, instance, info) => {
    console.error('[Global Error]', info, err)
    showToast({ type: 'fail', message: '出错了，请刷新重试' })
  }
}
