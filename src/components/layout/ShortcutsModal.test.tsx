// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ShortcutsModal from './ShortcutsModal'

afterEach(cleanup)

describe('ShortcutsModal', () => {
  it('renders keyboard shortcut entries', () => {
    render(<ShortcutsModal onClose={vi.fn()} />)
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
    expect(screen.getByText('Play / Pause')).toBeInTheDocument()
    expect(screen.getByText('Remove selected clip')).toBeInTheDocument()
    expect(screen.getByText('Undo')).toBeInTheDocument()
    expect(screen.getByText('Save project')).toBeInTheDocument()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<ShortcutsModal onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<ShortcutsModal onClose={onClose} />)
    fireEvent.click(container.firstChild as HTMLElement)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does NOT call onClose when inner card is clicked (stopPropagation)', () => {
    const onClose = vi.fn()
    const { container } = render(<ShortcutsModal onClose={onClose} />)
    // Click the inner card (second-level div), not the backdrop
    const innerCard = (container.firstChild as HTMLElement).firstChild as HTMLElement
    fireEvent.click(innerCard)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn()
    render(<ShortcutsModal onClose={onClose} />)
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('removes Escape keydown listener on unmount', () => {
    const onClose = vi.fn()
    const { unmount } = render(<ShortcutsModal onClose={onClose} />)
    unmount()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
