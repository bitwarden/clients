export const AutotypeShortcutOption = Object.freeze({
  Default: "default",
  Custom: "custom",
} as const);

export type AutotypeShortcutOption =
  (typeof AutotypeShortcutOption)[keyof typeof AutotypeShortcutOption];

/** Electron key names for the desktop app's built-in shortcut, shown as Ctrl+Alt+B. */
export const DEFAULT_AUTOTYPE_GA_KEYBOARD_SHORTCUT: readonly string[] = Object.freeze([
  "Control",
  "Alt",
  "B",
]);

const AUTOTYPE_SHORTCUT_MODIFIERS = new Set(["Control", "Alt", "Super"]);

const AUTOTYPE_SHORTCUT_TEXT_MODIFIERS: Record<string, string> = {
  control: "Control",
  ctrl: "Control",
  alt: "Alt",
  super: "Super",
  win: "Super",
};

/*
  Data stored on the Autotype GA policy.

  `default` stores the built-in shortcut, ["Control", "Alt", "B"] (Ctrl+Alt+B).
  `custom` stores Electron modifier names (Control, Alt, Super) plus a letter.
  Super is the Windows key, and the Command key on macOS.
*/
export type AutotypeGaPolicyData = {
  shortcutOption: AutotypeShortcutOption;
  defaultKeyboardShortcut: string[] | null;
};

/** One or two distinct modifiers, then a single letter A–Z. */
export function isAutotypeGaShortcut(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 3) {
    return false;
  }

  const modifiers = new Set<string>();
  for (let i = 0; i < value.length; i++) {
    const key = value[i];
    if (typeof key !== "string") {
      return false;
    }

    if (i < value.length - 1) {
      if (!AUTOTYPE_SHORTCUT_MODIFIERS.has(key) || modifiers.has(key)) {
        return false;
      }
      modifiers.add(key);
    } else if (!/^[A-Z]$/.test(key)) {
      return false;
    }
  }

  return true;
}

/** Parses a shortcut typed or shown in the field, such as "Ctrl + Alt + L". */
export function autotypeGaShortcutFromText(value: string): string[] | null {
  const keys: string[] = [];
  for (const part of value.split("+").map((part) => part.trim())) {
    const modifier = AUTOTYPE_SHORTCUT_TEXT_MODIFIERS[part.toLowerCase()];
    if (modifier != null) {
      keys.push(modifier);
    } else if (/^[a-z]$/i.test(part)) {
      keys.push(part.toUpperCase());
    } else {
      return null;
    }
  }

  return isAutotypeGaShortcut(keys) ? keys : null;
}
