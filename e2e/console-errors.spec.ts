import { test, expect } from '@playwright/test'

test('no ERR_FILE_NOT_FOUND or critical console errors on page load', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/')
  await page.waitForTimeout(2000)

  const fileNotFound = errors.filter((e) => e.includes('ERR_FILE_NOT_FOUND'))
  const aborted = errors.filter((e) => e.includes('Aborted()'))
  expect(fileNotFound).toHaveLength(0)
  expect(aborted).toHaveLength(0)
})

test('app renders timeline and preview without errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/')
  await expect(page.locator('text=BrowserCutter')).toBeVisible()
  await expect(page.locator('text=V1')).toBeVisible()

  // Open BPM panel to verify it loads
  const bpmBtn = page.locator('[title*="BPM"], [title*="bpm"]').first()
  if (await bpmBtn.count() > 0) {
    await bpmBtn.click()
    await expect(page.locator('text=BPM Cutting Tool')).toBeVisible({ timeout: 5000 })
  }

  // No JS exceptions during navigation
  expect(errors).toHaveLength(0)
})
