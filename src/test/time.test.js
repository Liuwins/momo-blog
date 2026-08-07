import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from '@/utils/time'

describe('formatRelativeTime', () => {
  it('should return "刚刚" for less than 1 minute', () => {
    const now = new Date()
    expect(formatRelativeTime(now.toISOString())).toBe('刚刚')
  })

  it('should return minutes ago', () => {
    const d = new Date(Date.now() - 5 * 60 * 1000)
    expect(formatRelativeTime(d.toISOString())).toBe('5分钟前')
  })

  it('should return hours ago', () => {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000)
    expect(formatRelativeTime(d.toISOString())).toBe('3小时前')
  })

  it('should return days ago', () => {
    const d = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    expect(formatRelativeTime(d.toISOString())).toBe('5天前')
  })

  it('should return formatted date for older than a week', () => {
    const d = new Date('2024-03-15T10:00:00')
    const result = formatRelativeTime(d.toISOString())
    expect(result).toMatch(/2024年.*月.*日/)
  })

  it('should handle invalid date', () => {
    expect(formatRelativeTime('invalid')).toBe('')
  })
})
