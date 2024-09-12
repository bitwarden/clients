import { BrowserWindow } from "electron";

import { WindowState } from "./models/domain/window-state";

export function applyPopupModalStyles(window: BrowserWindow) {
  //
}

export function applyMainWindowStyles(window: BrowserWindow, existingWindowState: WindowState) {
  window.setMinimumSize(400, 400);
  window.setSize(existingWindowState.width, existingWindowState.height);
  window.setPosition(existingWindowState.x, existingWindowState.y);
  window.setWindowButtonVisibility(true);
  window.setMenuBarVisibility(true);
}
