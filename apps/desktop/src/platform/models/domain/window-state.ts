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
