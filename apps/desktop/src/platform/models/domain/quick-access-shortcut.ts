export const DEFAULT_QUICK_ACCESS_SHORTCUT = "CommandOrControl+Shift+Space";

const validShortcutModifiers = new Set([
  "Alt",
  "Command",
  "CommandOrControl",
  "Control",
  "Shift",
  "Super",
]);

const activationShortcutModifiers = new Set([
  "Alt",
  "Command",
  "CommandOrControl",
  "Control",
  "Super",
]);

export function isQuickAccessShortcutValid(shortcut: string | null | undefined) {
  if (shortcut == null || shortcut.length === 0) {
    return false;
  }

  const parts = shortcut.split("+").filter((part) => part.length > 0);
  if (parts.length < 2 || parts.length > 5) {
    return false;
  }

  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);
  if (key !== "Space" && !/^[A-Z]$/.test(key)) {
    return false;
  }

  if (!modifiers.some((modifier) => activationShortcutModifiers.has(modifier))) {
    return false;
  }

  const seenModifiers = new Set<string>();
  return modifiers.every((modifier) => {
    if (!validShortcutModifiers.has(modifier) || seenModifiers.has(modifier)) {
      return false;
    }

    seenModifiers.add(modifier);
    return true;
  });
}
