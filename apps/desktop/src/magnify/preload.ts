import { contextBridge, ipcRenderer } from "electron";

import { MAGNIFY_IPC_CHANNELS } from "../autofill/models/ipc-channels";
import { MagnifyCommandRequest, MagnifyCommandResponse } from "../autofill/models/magnify-commands";

/**
 * Bitwarden Preload script.
 *
 * This is the preload script for Magnify.
 *
 * This file contains the "glue" between the main process and the renderer process. Please ensure
 * that you have read through the following articles before modifying any preload script.
 *
 * https://www.electronjs.org/docs/latest/tutorial/tutorial-preload
 * https://www.electronjs.org/docs/latest/api/context-bridge
 */

const ipc = {
  // The useage of `Extract` on the "type" provides type safety in that the response command
  // Type is the same as the request command type. This allows compile time guarantees without
  // needing to manually handle validatation of each response command type.
  sendCommand: async <T extends MagnifyCommandRequest>(
    command: T,
  ): Promise<Extract<MagnifyCommandResponse, { type: T["type"] }>> => {
    return (await ipcRenderer.invoke(MAGNIFY_IPC_CHANNELS.MAGNIFY_COMMAND, command)) as Extract<
      MagnifyCommandResponse,
      { type: T["type"] }
    >;
  },
  platform: process.platform,
  resize: (height: number): void => {
    ipcRenderer.send(MAGNIFY_IPC_CHANNELS.MAGNIFY_RESIZE, height);
  },
};

contextBridge.exposeInMainWorld("ipc", ipc);
