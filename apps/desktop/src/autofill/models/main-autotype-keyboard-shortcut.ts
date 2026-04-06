/**
 Electron's representation of modifier keys
 <https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts#cross-platform-modifiers>
*/
export const CONTROL_KEY_STR = "Control";
export const ALT_KEY_STR = "Alt";
export const SUPER_KEY_STR = "Super";

export const VALID_SHORTCUT_MODIFIER_KEYS: string[] = [CONTROL_KEY_STR, ALT_KEY_STR, SUPER_KEY_STR];

export const DEFAULT_KEYBOARD_SHORTCUT: string[] = [CONTROL_KEY_STR, ALT_KEY_STR, "B"];

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
  set(newAutotypeKeyboardShortcut: string[]) {
    if (!this.#keyboardShortcutIsValid(newAutotypeKeyboardShortcut)) {
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

    See Electron keyboard shorcut docs for more info:
    https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts
  */
  getElectronFormat() {
    return this.autotypeKeyboardShortcut.join("+");
  }

  /*
    This private function validates the strArray input to make sure the array contains
    valid, currently accepted shortcut keys for Windows.

    Valid shortcut keys: Control, Alt, Super, letters A - Z
    Platform specifics:
      - On Windows, Super maps to the Windows key.
      - On MacOS, Super maps to the Command key.
      - On MacOS, Alt maps to the Option key.

    See Electron keyboard shorcut docs for more info:
    https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts
  */
  #keyboardShortcutIsValid(strArray: string[]) {
    const UNICODE_LOWER_BOUND = 65; // unicode 'A'
    const UNICODE_UPPER_BOUND = 90; // unicode 'Z'
    const MIN_LENGTH: number = 2;
    const MAX_LENGTH: number = 3;

    // Ensure strArray is a string array of valid length
    if (
      strArray === undefined ||
      strArray === null ||
      strArray.length < MIN_LENGTH ||
      strArray.length > MAX_LENGTH
    ) {
      return false;
    }

    // Ensure strArray is all modifier keys, and that the last key is a letter
    for (let i = 0; i < strArray.length; i++) {
      if (i < strArray.length - 1) {
        if (!VALID_SHORTCUT_MODIFIER_KEYS.includes(strArray[i])) {
          return false;
        }
      } else {
        const unicodeValue: number = strArray[i].charCodeAt(0);

        if (
          Number.isNaN(unicodeValue) ||
          unicodeValue < UNICODE_LOWER_BOUND ||
          unicodeValue > UNICODE_UPPER_BOUND
        ) {
          return false;
        }
      }
    }

    return true;
  }
}
