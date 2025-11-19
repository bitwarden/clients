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

  // need to guard against null/undefined values and ensure values are valid
  if (existingWindowState) {
    if (
      typeof existingWindowState.width === "number" &&
      typeof existingWindowState.height === "number" &&
      Number.isFinite(existingWindowState.width) &&
      Number.isFinite(existingWindowState.height) &&
      existingWindowState.width > 0 &&
      existingWindowState.height > 0
    ) {
      try {
        // Ensure values are integers as Electron expects integer pixel values
        window.setSize(
          Math.round(existingWindowState.width),
          Math.round(existingWindowState.height),
        );
      } catch {
        // Silently fail - window will use default size
      }
    }

    if (
      typeof existingWindowState.x === "number" &&
      typeof existingWindowState.y === "number" &&
      Number.isFinite(existingWindowState.x) &&
      Number.isFinite(existingWindowState.y)
    ) {
      try {
        // Ensure values are integers as Electron expects integer pixel values
        window.setPosition(Math.round(existingWindowState.x), Math.round(existingWindowState.y));
      } catch {
        // Silently fail - window will use default position
      }
    }
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
