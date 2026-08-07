import { showToast, showConfirmDialog, showSuccessToast, showFailToast } from 'vant'
import 'vant/es/toast/style'
import 'vant/es/dialog/style'

export const toast = {
  success: (message) => showSuccessToast(message),
  fail: (message) => showFailToast(message),
  info: (message) => showToast(message),
}

export const dialog = {
  confirm: (options) => showConfirmDialog(options),
}

export function installPlugins(app) {
  app.config.globalProperties.$toast = toast
  app.config.globalProperties.$dialog = dialog
}
