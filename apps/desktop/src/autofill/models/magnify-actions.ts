import { MagnifyItem } from "./magnify-items";

/*
  A MagnifyAction represents a user-facing action that can be taken
  on a selected item in the Magnify search results.

  - id:              a unique string key for this action, used for fast lookup and dispatch
  - magnifyItemType: the MagnifyItem type this action applies to, or null
                     if it applies to all item types (e.g. navigation)
  - labelMacOs:      the keyboard shortcut badge text shown on macOS (left side of action bar)
  - labelWindows:    the keyboard shortcut badge text shown on Windows (left side of action bar)
  - labelLinux:      the keyboard shortcut badge text shown on Linux (left side of action bar)
  - description:     the human-readable description of the action (right side of action bar)
  - shortcuts:       the keyboard combinations that trigger this action, where
                     each inner array is one combination (e.g. ["Meta", "C"]),
                     or null if the action has no keyboard shortcut
  - completionText:  the text briefly shown in the UI after the action completes,
                     or null if no completion feedback is shown
*/
export type MagnifyAction = {
  id: string;
  magnifyItemType: MagnifyItem | null;
  labelMacOs: string;
  labelWindows: string;
  labelLinux: string;
  description: string;
  shortcuts: string[][] | null;
  completionText: string | null;
};

/*
  The full list of user-facing actions available in Magnify.
  Consumed by the action bar component to render keyboard hints,
  and by the keyboard handler to dispatch actions.
*/
export const MAGNIFY_ACTIONS: MagnifyAction[] = [
  {
    id: "global-navigate",
    magnifyItemType: null,
    labelMacOs: "↑↓",
    labelWindows: "↑↓",
    labelLinux: "↑↓",
    description: "Navigate",
    shortcuts: null,
    completionText: null,
  },
  {
    id: "magnifyLoginItem-copyPassword",
    magnifyItemType: MagnifyItem.Login,
    labelMacOs: "⌘C",
    labelWindows: "Ctrl+C",
    labelLinux: "Ctrl+C",
    description: "Copy password",
    shortcuts: [["CommandOrControl", "C"]],
    completionText: "✓ Copied",
  },
  {
    id: "magnifyLoginItem-copyUsername",
    magnifyItemType: MagnifyItem.Login,
    labelMacOs: "⌘⇧C",
    labelWindows: "Ctrl+⇧C",
    labelLinux: "Ctrl+⇧C",
    description: "Copy username",
    shortcuts: [["CommandOrControl", "Shift", "C"]],
    completionText: "✓ Copied",
  },
  {
    id: "magnifyCardItem-copyCardNumber",
    magnifyItemType: MagnifyItem.Card,
    labelMacOs: "C",
    labelWindows: "C",
    labelLinux: "C",
    description: "Copy card number",
    shortcuts: [["C"]],
    completionText: "✓ Copied",
  },
  {
    id: "magnifyCardItem-copyCardCode",
    magnifyItemType: MagnifyItem.Card,
    labelMacOs: "⇧C",
    labelWindows: "⇧C",
    labelLinux: "⇧C",
    description: "Copy security code",
    shortcuts: [["Shift", "C"]],
    completionText: "✓ Copied",
  },
  {
    id: "magnifyCardItem-copyCardExpiration",
    magnifyItemType: MagnifyItem.Card,
    labelMacOs: "X",
    labelWindows: "X",
    labelLinux: "X",
    description: "Copy expiration",
    shortcuts: [["X"]],
    completionText: "✓ Copied",
  },
];
