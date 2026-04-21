# TODOS

## Phase 13+

### Keyboard shortcut modal — focus trap and focus restore
**What:** Add a focus trap to the ShortcutsModal so Tab stays within it, and restore focus to the trigger button on close.  
**Why:** Without a focus trap, keyboard users can Tab to elements behind the backdrop. WCAG 2.1 SC 2.1.2 requires modal focus containment.  
**Pros:** ~20 LOC with a focus-trap library or manual sentinel nodes.  
**Cons:** None significant.  
**Context:** `src/components/layout/ShortcutsModal.tsx`. On mount, focus the X button. On unmount, restore focus to the HelpCircle button in TopBar (pass a `triggerRef` prop or use a custom hook).

---

### Speed ramp / time remapping per segment
**What:** Allow variable playback speed within a single clip segment — ease in/out, ramps.  
**Why:** Currently speed is a fixed scalar per segment. Editors often need slow-mo entry and full-speed exit.  
**Pros:** High production value for music video / highlight reel use cases.  
**Cons:** Requires building a speed curve editor UI and reworking the playback tick to interpolate speed at each frame.

---

### Multi-track audio mixing
**What:** Show separate audio tracks below V1, each with their own fader.  
**Why:** BrowserCutter currently mixes all audio at master volume only — no per-clip gain, no music vs VO separation.  
**Pros:** Unblocks basic podcasting and b-roll voiceover workflows.  
**Cons:** Requires audio graph refactor in the playback engine (GainNode per track).
