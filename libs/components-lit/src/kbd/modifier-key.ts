export type ModifierKey = "Command" | "Ctrl";

let current: ModifierKey | undefined;
const listeners = new Set<(key: ModifierKey) => void>();

function detectInitialModifier(): ModifierKey {
  const nav = globalThis.navigator;
  const isMac = nav?.platform?.startsWith("Mac") || /Macintosh/.test(nav?.userAgent ?? "");
  return isMac ? "Command" : "Ctrl";
}

function onKeydown(event: KeyboardEvent) {
  // The Windows key also reports as "Meta", so a bare modifier press is not evidence either.
  if (event.key === "Meta" || event.key === "Control") {
    return;
  }
  if (event.metaKey && !event.ctrlKey && current !== "Command") {
    current = "Command";
    listeners.forEach((listener) => listener("Command"));
    document.removeEventListener("keydown", onKeydown, { capture: true });
  }
}

/**
 * The platform modifier key ("Command" on Mac, "Ctrl" elsewhere). Seeded from `navigator` and
 * refined to "Command" the first time a Cmd chord is observed. Refinement is one-way: Cmd is
 * Apple-exclusive, but a Ctrl chord proves nothing (the macOS caret bindings fire while typing).
 */
export function getModifierKey(): ModifierKey {
  if (current === undefined) {
    current = detectInitialModifier();
    if (current === "Ctrl") {
      document.addEventListener("keydown", onKeydown, { capture: true });
    }
  }
  return current;
}

/** Display glyph for the modifier key: "⌘" on Mac, "Ctrl" elsewhere. */
export function getModifierGlyph(): string {
  return getModifierKey() === "Command" ? "⌘" : "Ctrl";
}

/** Registers a callback for when the modifier key is refined. Returns an unsubscribe function. */
export function onModifierKeyChange(listener: (key: ModifierKey) => void): () => void {
  getModifierKey();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
