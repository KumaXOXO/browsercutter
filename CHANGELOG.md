# Changelog

## [0.13.0] — 2026-04-21

### Added
- Focus trap in ShortcutsModal: Tab and Shift+Tab cycle only within the dialog (WCAG 2.1 SC 2.1.2)
- Auto-focus the Close button when the shortcuts modal opens
- Focus restore: closing the modal returns focus to the HelpCircle trigger button
- `IconBtn` now forwards its `ref` so the trigger button can be targeted for focus restore
- 3 new tests for focus behavior (auto-focus, Tab trap, Shift+Tab trap); 128 tests passing

## [0.12.0] — 2026-04-20

### Added
- Keyboard shortcuts reference panel (`?` key or HelpCircle button in TopBar opens a modal cheat-sheet of all shortcuts)
- `ShortcutsModal` component with full ARIA support (`role="dialog"`, `aria-modal`, `aria-label`)
- Test suite with `@testing-library/react` + jsdom; 6 tests for `ShortcutsModal`, 125 passing overall

### Fixed
- Space / H / M / Delete / Backspace shortcuts no longer fire through open modals (ref-based guard in TopBar `onKey`)
- Escape in ShortcutsModal uses `stopImmediatePropagation` to prevent TopBar's parallel listener from also firing
- `onClose` prop to ShortcutsModal is stable (`useCallback`) to avoid unnecessary Escape listener re-registration

## [0.11.0] — 2026-04-19

### Added
- Adjustment layers (color grading overlays per segment)
- Transition system with xfade support in export worker
- BPM sync / beat grid

## [0.8.0] — 2026-04-18

### Added
- Phase 8: export UI, format/quality selectors, Tier 1/4 export worker with filter_complex
- Export modal with format and quality controls
- saveProject patch for export state persistence
