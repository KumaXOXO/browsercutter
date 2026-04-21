// src/lib/fontManager.ts

export async function loadCustomFont(
  file: File,
  addFont: (name: string) => void,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const name = file.name.replace(/\.[^.]+$/, '')
  try {
    const buffer = await file.arrayBuffer()
    const face = new FontFace(name, buffer)
    await face.load()
    document.fonts.add(face)
    addFont(name)
    return { ok: true, name }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
