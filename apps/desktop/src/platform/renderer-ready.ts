/**
 * Sent by the renderer once it is listening for messages from main.
 *
 * Creating a window is not enough to receive a message: `webContents.send` drops anything that
 * arrives before the renderer has attached its listener, so main waits for this before sending to
 * a renderer it has just recreated.
 */
export const RENDERER_READY_CHANNEL = "renderer.ready";
