import {
  DEFAULT_AUTOTYPE_GA_KEYBOARD_SHORTCUT,
  isAutotypeGaShortcut,
} from "@bitwarden/common/desktop-native/models/autotype-ga-policy.data";

/**
 Electron's representation of modifier keys
 <https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts#cross-platform-modifiers>
*/
// Shared with the web Autotype GA policy, which shows this as its Default option
export const DEFAULT_KEYBOARD_SHORTCUT: string[] = [...DEFAULT_AUTOTYPE_GA_KEYBOARD_SHORTCUT];

/*
  This class provides the following:
  - A way to get and set an AutotypeKeyboardShortcut value within the main process
  - A way to set an AutotypeKeyboardShortcut with validation
  - A way to "get" the value in string array format or a single string format for electron
  - Default shortcut support

  This is currently only supported for Windows operating systems.
*/
export class AutotypeKeyboardShortcut {
  private autotypeKeyboardShortcut: string[];

  constructor() {
    this.autotypeKeyboardShortcut = DEFAULT_KEYBOARD_SHORTCUT;
  }

  /*
    Returns a boolean value indicating if the autotypeKeyboardShortcut
    was valid and set or not.
  */
  set(newAutotypeKeyboardShortcut: string[]): boolean {
    if (!isAutotypeGaShortcut(newAutotypeKeyboardShortcut)) {
      return false;
    }

    this.autotypeKeyboardShortcut = newAutotypeKeyboardShortcut;
    return true;
  }

  /*
    Returns the autotype keyboard shortcut as a string array.
  */
  getArrayFormat() {
    return this.autotypeKeyboardShortcut;
  }

  /*
    Returns the autotype keyboard shortcut as a single string, as
    Electron expects. Please note this does not reorder the keys.

    See Electron keyboard shortcut docs for more info:
    https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts
  */
  getElectronFormat() {
    return this.autotypeKeyboardShortcut.join("+");
  }
}
