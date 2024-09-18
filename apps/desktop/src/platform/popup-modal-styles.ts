import { BrowserWindow } from "electron";

import { WindowState } from "./models/domain/window-state";

const popupWidth = 450;
const popupHeight = 450;

export function applyPopupModalStyles(window: BrowserWindow) {
  window.unmaximize();
  window.setSize(popupWidth, popupHeight);
  window.center();
  window.setWindowButtonVisibility(false);
  window.setMenuBarVisibility(false);
  window.setResizable(false);
  window.setAlwaysOnTop(true);

  // recover from full screen is a bit more hassle
  if (window.isFullScreen()) {
    window.setFullScreen(false);
    window.once("leave-full-screen", () => {
      window.setSize(popupWidth, popupHeight);
      window.center();
    });
  }
}

export function applyMainWindowStyles(window: BrowserWindow, existingWindowState: WindowState) {
  window.setMinimumSize(400, 400);
  window.setSize(existingWindowState.width, existingWindowState.height);
  window.setPosition(existingWindowState.x, existingWindowState.y);
  window.setWindowButtonVisibility(true);
  window.setMenuBarVisibility(true);
  window.setResizable(true);
  window.setAlwaysOnTop(false);
  // window.hide();

  // console.log("is maximized", existingWindowState.isMaximized);
  // window.setFullScreen(existingWindowState.isMaximized);

  // if (existingWindowState.isMaximized) {
  //   window.maximize();
  // }
}
