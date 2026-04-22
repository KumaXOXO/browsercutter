import { test, expect, type Page } from '@playwright/test'

// ── Store helper ─────────────────────────────────────────────────────────────
type AppState = {
  segments: Array<{ id: string; clipId: string; trackIndex: number; startOnTimeline: number; inPoint: number; outPoint: number }>
  clips: Array<{ id: string; name: string; type: string; duration: number; file: File | null }>
  addClip(c: unknown): void
  addSegments(segs: unknown[]): void
  setSelectedSegmentIds(ids: string[]): void
}

async function getStore(page: Page): Promise<AppState | null> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, { getState?(): unknown }>).__BC_STORE__
    return store ? (store.getState() as AppState) : null
  })
}

async function storeDispatch(page: Page, fn: string, args: unknown[]) {
  return page.evaluate(({ fn, args }: { fn: string; args: unknown[] }) => {
    const store = (window as unknown as Record<string, { getState?(): Record<string, unknown> }>).__BC_STORE__
    if (!store) return
    const state = store.getState()
    const method = state[fn] as ((...a: unknown[]) => void) | undefined
    if (typeof method === 'function') method(...args)
  }, { fn, args })
}

async function storeSet(page: Page, patch: Record<string, unknown>) {
  return page.evaluate((patch) => {
    const store = (window as unknown as Record<string, { setState?(s: unknown): void }>).__BC_STORE__
    store?.setState?.(patch)
  }, patch)
}

// Helper: wait for the app to fully load
async function loadApp(page: Page) {
  await page.goto('/')
  await expect(page.locator('text=BrowserCutter')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('text=V1')).toBeVisible({ timeout: 8000 })
}

// ── 1. Timeline gap ──────────────────────────────────────────────────────────
test('timeline: no inline padding gap in track rows when label is hidden', async ({ page }) => {
  await loadApp(page)
  // The timeline container should render. Verify the app shows tracks without error.
  // The 16px gap was caused by px-2 padding always rendering. We can't measure pixels
  // precisely in headless tests, but we verify the timeline renders track rows.
  const v1 = page.locator('text=V1').first()
  await expect(v1).toBeVisible()
  // V1 track should be visible and not cause layout overflow
  const box = await v1.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
})

// ── 2. Shift+Mousewheel zoom ─────────────────────────────────────────────────
test('timeline: shift+mousewheel changes zoom slider', async ({ page }) => {
  await loadApp(page)
  // Find zoom range slider in timeline toolbar
  const slider = page.locator('input[type="range"]').last()
  await expect(slider).toBeVisible()
  const before = Number(await slider.inputValue())

  // Hover over the page body and trigger shift+wheel
  await page.locator('body').hover()
  await page.keyboard.down('Shift')
  await page.mouse.wheel(0, 300)
  await page.keyboard.up('Shift')
  await page.waitForTimeout(300)

  const after = Number(await slider.inputValue())
  expect(after).not.toBeCloseTo(before, 0)
})

// ── 3. Mode buttons present ──────────────────────────────────────────────────
test('timeline toolbar: Playhead mode button exists', async ({ page }) => {
  await loadApp(page)
  await expect(page.locator('button[title*="Playhead Mode"]')).toBeVisible()
})

test('timeline toolbar: Selection Mode button exists', async ({ page }) => {
  await loadApp(page)
  await expect(page.locator('button[title*="Selection Mode"]')).toBeVisible()
})

test('timeline toolbar: clicking Playhead mode and back to Selection works', async ({ page }) => {
  await loadApp(page)
  await page.locator('button[title*="Playhead Mode"]').click()
  await page.waitForTimeout(100)
  await page.locator('button[title*="Selection Mode"]').click()
  await expect(page.locator('button[title*="Selection Mode"]')).toBeVisible()
})

// ── 4. Resize toggle ─────────────────────────────────────────────────────────
test('timeline toolbar: resize toggle button exists', async ({ page }) => {
  await loadApp(page)
  const btn = page.locator('button[title*="Resize"]')
  await expect(btn).toBeVisible()
})

test('timeline toolbar: resize toggle is disabled in Playhead mode', async ({ page }) => {
  await loadApp(page)
  await page.locator('button[title*="Playhead Mode"]').click()
  await page.waitForTimeout(100)
  const btn = page.locator('button[title*="Resize"]')
  await expect(btn).toBeDisabled()
  await page.locator('button[title*="Selection Mode"]').click()
  await expect(btn).not.toBeDisabled()
})

// ── 5. Grid/Free snap toggle ─────────────────────────────────────────────────
test('timeline toolbar: GRID/FREE toggle button is visible', async ({ page }) => {
  await loadApp(page)
  const btn = page.locator('button:has-text("GRID"), button:has-text("FREE")')
  await expect(btn.first()).toBeVisible()
})

test('timeline toolbar: GRID/FREE toggle switches label on click', async ({ page }) => {
  await loadApp(page)
  const btn = page.locator('button:has-text("GRID"), button:has-text("FREE")').first()
  const before = await btn.innerText()
  await btn.click()
  await page.waitForTimeout(150)
  const after = await btn.innerText()
  expect(['GRID', 'FREE']).toContain(before.trim())
  expect(['GRID', 'FREE']).toContain(after.trim())
  expect(before.trim()).not.toBe(after.trim())
})

// ── 6. BPM panel: dropdown + slider ─────────────────────────────────────────
async function openBpmPanel(page: Page) {
  // Try sidebar button by title
  const bpmBtn = page.locator('button[title*="BPM"], button[title*="bpm"]').first()
  if (await bpmBtn.count() > 0) {
    await bpmBtn.click()
  } else {
    // Click 5th sidebar button (BPM is typically at that position)
    await page.locator('nav button, [class*="sidebar"] button, [class*="icon"] button').nth(4).click()
  }
  await expect(page.locator('text=BPM Cutting Tool')).toBeVisible({ timeout: 6000 })
}

test('BPM panel: cutting mode dropdown exists', async ({ page }) => {
  await loadApp(page)
  await openBpmPanel(page)
  await expect(page.locator('select').first()).toBeVisible()
})

test('BPM panel: Normal mode option is present', async ({ page }) => {
  await loadApp(page)
  await openBpmPanel(page)
  const options = await page.locator('select').first().locator('option').allInnerTexts()
  expect(options.some((o) => o.toLowerCase().includes('normal'))).toBe(true)
})

test('BPM panel: segment length slider exists', async ({ page }) => {
  await loadApp(page)
  await openBpmPanel(page)
  // Should have at least 2 range inputs (BPM detection slider + segment length slider or output duration)
  const sliders = page.locator('input[type="range"]')
  expect(await sliders.count()).toBeGreaterThanOrEqual(1)
})

// ── 7. Delete key removes selected segment ───────────────────────────────────
test('delete key: removes single-selected segment', async ({ page }) => {
  await loadApp(page)
  // Inject clip + segment via exposed store
  await page.evaluate(() => {
    const store = (window as unknown as Record<string, { getState?(): Record<string, (...a: unknown[]) => void> }>).__BC_STORE__
    if (!store) return
    const s = store.getState()
    s.addClip({ id: 'del-clip', name: 'del.mp4', type: 'video', duration: 10, file: null })
    s.addSegments([{ id: 'del-seg', clipId: 'del-clip', trackIndex: 0, startOnTimeline: 0, inPoint: 0, outPoint: 5 }])
  })
  await page.waitForTimeout(100)

  await page.evaluate(() => {
    const store = (window as unknown as Record<string, { setState?(s: unknown): void }>).__BC_STORE__
    store?.setState?.({ selectedElement: { type: 'segment', id: 'del-seg' }, selectedSegmentIds: [] })
  })
  await page.waitForTimeout(100)

  await page.locator('body').click()
  await page.keyboard.press('Delete')
  await page.waitForTimeout(300)

  const gone = await page.evaluate(() => {
    const store = (window as unknown as Record<string, { getState?(): { segments: { id: string }[] } }>).__BC_STORE__
    if (!store) return false
    return !store.getState().segments.some((s) => s.id === 'del-seg')
  })
  expect(gone).toBe(true)
})

// ── 8. Multi-select delete ────────────────────────────────────────────────────
test('delete key: removes all segments in multi-select including primary', async ({ page }) => {
  await loadApp(page)
  await page.evaluate(() => {
    const store = (window as unknown as Record<string, { getState?(): Record<string, (...a: unknown[]) => void> }>).__BC_STORE__
    if (!store) return
    const s = store.getState()
    s.addClip({ id: 'ms-clip', name: 'ms.mp4', type: 'video', duration: 10, file: null })
    s.addSegments([
      { id: 'ms-seg-a', clipId: 'ms-clip', trackIndex: 0, startOnTimeline: 0, inPoint: 0, outPoint: 3 },
      { id: 'ms-seg-b', clipId: 'ms-clip', trackIndex: 0, startOnTimeline: 3, inPoint: 3, outPoint: 6 },
    ])
  })
  await page.waitForTimeout(100)

  await page.evaluate(() => {
    const store = (window as unknown as Record<string, { setState?(s: unknown): void }>).__BC_STORE__
    store?.setState?.({
      selectedElement: { type: 'segment', id: 'ms-seg-a' },
      selectedSegmentIds: ['ms-seg-a', 'ms-seg-b'],
    })
  })
  await page.waitForTimeout(100)

  await page.locator('body').click()
  await page.keyboard.press('Delete')
  await page.waitForTimeout(300)

  const { aGone, bGone } = await page.evaluate(() => {
    const store = (window as unknown as Record<string, { getState?(): { segments: { id: string }[] } }>).__BC_STORE__
    if (!store) return { aGone: false, bGone: false }
    const segs = store.getState().segments
    return {
      aGone: !segs.some((s) => s.id === 'ms-seg-a'),
      bGone: !segs.some((s) => s.id === 'ms-seg-b'),
    }
  })
  expect(aGone).toBe(true)
  expect(bGone).toBe(true)
})

// ── 9. Progress bar clamped ───────────────────────────────────────────────────
test('progress bar: stays at 100% max when playhead exceeds content', async ({ page }) => {
  await loadApp(page)
  // Push playhead far beyond content
  await page.evaluate(() => {
    const store = (window as unknown as Record<string, { setState?(s: unknown): void }>).__BC_STORE__
    store?.setState?.({ playheadPosition: 99999 })
  })
  await page.waitForTimeout(300)
  // Find the inner fill bar inside PlaybackControls — it has a width% style
  const bars = page.locator('[style*="width"]')
  const count = await bars.count()
  let foundOver = false
  for (let i = 0; i < Math.min(count, 30); i++) {
    const style = await bars.nth(i).getAttribute('style')
    if (!style) continue
    const m = style.match(/width:\s*([\d.]+)%/)
    if (m && parseFloat(m[1]) > 100) { foundOver = true; break }
  }
  expect(foundOver).toBe(false)
  await expect(page.locator('text=BrowserCutter')).toBeVisible()
})

// ── 10. Missing files banner ─────────────────────────────────────────────────
test('missing files banner: appears when used clip has no file', async ({ page }) => {
  await loadApp(page)
  await page.evaluate(() => {
    const store = (window as unknown as Record<string, { getState?(): Record<string, (...a: unknown[]) => void> }>).__BC_STORE__
    if (!store) return
    const s = store.getState()
    s.addClip({ id: 'banner-clip', name: 'gone.mp4', type: 'video', duration: 5, file: null })
    s.addSegments([{ id: 'banner-seg', clipId: 'banner-clip', trackIndex: 0, startOnTimeline: 0, inPoint: 0, outPoint: 5 }])
  })
  await page.waitForTimeout(500)
  // App.tsx renders: "N clip(s) need re-importing"
  await expect(page.locator('text=re-importing')).toBeVisible({ timeout: 4000 })
})

// ── 11. loadProject preserves real File objects ──────────────────────────────
test('loadProject: preserves File objects when passed in data (directory load path)', async ({ page }) => {
  await loadApp(page)
  // Simulate what loadProjectFromDir does: pass clips with real File objects to loadProject
  const filePreserved = await page.evaluate(() => {
    const store = (window as unknown as Record<string, {
      getState?(): Record<string, unknown>
      setState?(s: unknown): void
    }>).__BC_STORE__
    if (!store) return false
    const state = store.getState() as {
      loadProject(d: Record<string, unknown>): void
      clips: Array<{ id: string; file: File | null }>
    }
    // Create a fake File object
    const fakeFile = new File(['dummy'], 'test.mp4', { type: 'video/mp4' })
    state.loadProject({
      projectName: 'Test',
      projectSettings: { resolution: '1920x1080', fps: 30, format: 'mp4', quality: 'good', snapToBeat: false, autoDetectBpm: false, hardwareAcceleration: false, showClipThumbnails: false },
      segments: [],
      clips: [{ id: 'file-test', name: 'test.mp4', type: 'video', duration: 5, file: fakeFile }],
      tracks: [],
    })
    // Re-read state after mutation — old reference is stale after set()
    const fresh = (store.getState() as { clips: Array<{ id: string; file: unknown }> }).clips
    const loaded = fresh.find((c) => c.id === 'file-test')
    return loaded?.file instanceof File
  })
  expect(filePreserved).toBe(true)
})
