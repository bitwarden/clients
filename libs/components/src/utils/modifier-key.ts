/**
 * True when exactly one of Meta/Ctrl is held — the "primary modifier" chord, Cmd on Mac and Ctrl
 * elsewhere. Both held is deliberately not a match: it is ambiguous and usually accidental.
 */
export function isPrimaryModifier(event: KeyboardEvent): boolean {
  return event.metaKey !== event.ctrlKey;
}

/**
 * Best-guess platform modifier from `navigator`. Only a seed — a later Cmd chord is ground truth.
 * See `KeyboardShortcutService`, which owns the refinement.
 */
export function detectInitialModifier(document: Document): "Command" | "Ctrl" {
  const nav = document.defaultView?.navigator;
  const isMac = nav?.platform?.startsWith("Mac") || /Macintosh/.test(nav?.userAgent ?? "");
  return isMac ? "Command" : "Ctrl";
}
