import { expect, vi } from 'vitest'

vi.mock('vant', () => ({
  showToast: vi.fn(),
  showSuccessToast: vi.fn(),
  showFailToast: vi.fn(),
  showConfirmDialog: vi.fn(),
  showImagePreview: vi.fn()
}))
