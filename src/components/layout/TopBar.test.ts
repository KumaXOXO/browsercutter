import { describe, it, expect } from 'vitest'
import { validateProjectJSON } from './TopBar'

describe('validateProjectJSON', () => {
  it('accepts valid project JSON', () => {
    const json = { segments: [], clips: [], projectSettings: { resolution: '1920x1080' } }
    const result = validateProjectJSON(json)
    expect(result.valid).toBe(true)
  })

  it('rejects null', () => {
    const result = validateProjectJSON(null)
    expect(result.valid).toBe(false)
    expect((result as { valid: false; error: string }).error).toMatch(/Invalid/i)
  })

  it('rejects array', () => {
    const result = validateProjectJSON([])
    expect(result.valid).toBe(false)
  })

  it('rejects missing segments', () => {
    const result = validateProjectJSON({ clips: [], projectSettings: {} })
    expect(result.valid).toBe(false)
    expect((result as { valid: false; error: string }).error).toMatch(/segments/i)
  })

  it('rejects non-array segments', () => {
    const result = validateProjectJSON({ segments: 'bad', clips: [], projectSettings: {} })
    expect(result.valid).toBe(false)
  })

  it('rejects missing clips', () => {
    const result = validateProjectJSON({ segments: [], projectSettings: {} })
    expect(result.valid).toBe(false)
    expect((result as { valid: false; error: string }).error).toMatch(/clips/i)
  })

  it('rejects missing projectSettings', () => {
    const result = validateProjectJSON({ segments: [], clips: [] })
    expect(result.valid).toBe(false)
    expect((result as { valid: false; error: string }).error).toMatch(/projectSettings/i)
  })

  it('rejects null projectSettings', () => {
    const result = validateProjectJSON({ segments: [], clips: [], projectSettings: null })
    expect(result.valid).toBe(false)
  })
})
