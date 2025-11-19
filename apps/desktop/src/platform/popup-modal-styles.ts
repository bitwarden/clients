import { BrowserWindow } from "electron";

import { WindowState } from "./models/domain/window-state";

// change as needed, however limited by mainwindow minimum size
const popupWidth = 680;
const popupHeight = 500;

type Position = { x: number; y: number };

export function applyPopupModalStyles(window: BrowserWindow, position?: Position) {
  window.unmaximize();
  window.setSize(popupWidth, popupHeight);
  window.setWindowButtonVisibility?.(false);
  window.setMenuBarVisibility?.(false);
  window.setResizable(false);
  window.setAlwaysOnTop(true);

  // Adjusting from full screen is a bit more hassle
  if (window.isFullScreen()) {
    window.setFullScreen(false);
    window.once("leave-full-screen", () => {
      window.setSize(popupWidth, popupHeight);
      positionWindow(window, position);
    });
  } else {
    // If not in full screen
    positionWindow(window, position);
  }
}

function positionWindow(window: BrowserWindow, position?: Position) {
  if (position) {
    const centeredX = position.x - popupWidth / 2;
    const centeredY = position.y - popupHeight / 2;
    window.setPosition(centeredX, centeredY);
  } else {
    window.center();
  }
}

export function applyMainWindowStyles(window: BrowserWindow, existingWindowState: WindowState) {
  window.setMinimumSize(680, 500);

  // need to guard against null/undefined values
  try {
    if (existingWindowState?.width && existingWindowState?.height) {
      window.setSize(existingWindowState.width, existingWindowState.height);
    }

    if (existingWindowState?.x && existingWindowState?.y) {
      window.setPosition(existingWindowState.x, existingWindowState.y);
    }
  } catch (e) {
    this.logService.error("Error applying main window styles:", e);
  }

  window.setWindowButtonVisibility?.(true);
  window.setMenuBarVisibility?.(true);
  window.setResizable(true);
  window.setAlwaysOnTop(false);

  // We're currently not recovering the maximized state, mostly due to conflicts with hiding the window.
  // window.setFullScreen(existingWindowState.isMaximized);

  // if (existingWindowState.isMaximized) {
  //   window.maximize();
  // }
}
