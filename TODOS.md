# TODOS

## Phase 12+

### Export filter_complex for dissolve/wipe/slide/zoom transitions
**What:** Extend the Phase 8 FFmpeg export worker to render the new Phase 11 CSS transitions as actual video transitions in the output file.  
**Why:** Phase 11 transitions only play in the preview player — the exported video still cuts. Users who set a dissolve or wipe expect to see it in the export.  
**Pros:** Completes the export parity story for the 4 new transition types.  
**Cons:** FFmpeg `xfade` filter has limited transition types (dissolve, wipe, slide, zoom all map cleanly); requires reworking the filter_complex chain in `exportWorker.ts` to chain xfade across segment boundaries.  
**Context:** `src/workers/exportWorker.ts` currently builds a concat demuxer. Transitions require the xfade filter instead: `[0:v][1:v]xfade=transition=dissolve:duration=0.5:offset=<seg_end>`. Each boundary with a non-cut transition gets its own xfade node. Start by reading how Phase 8 builds filter_complex, then extend it for xfade.

---

### Keyboard shortcut reference panel
**What:** An overlay (?) button in the top bar that shows a cheat-sheet of all keyboard shortcuts.  
**Why:** Space bar, H (hide), M (mute), Delete/Backspace (remove), and future shortcuts are not discoverable — users have to find them by accident or read the source.  
**Pros:** ~40 LOC, no new dependencies, zero impact on the critical path.  
**Cons:** None — pure additive UI.
