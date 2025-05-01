// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export class WindowState {
  width?: number;
  height?: number;
  isMaximized?: boolean;
  // TODO: displayBounds is an Electron.Rectangle.
  // We need to establish some kind of client-specific global state, similar to the way we already extend a base Account.
  displayBounds: Electron.Rectangle;
  x?: number;
  y?: number;
  zoomFactor?: number;
}

export class ModalModeState {
  isModalModeActive: boolean;
  modalPosition?: { x: number; y: number }; // Modal position is often passed from the native UI
}
