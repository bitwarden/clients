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
  sendCommand: async (command: MagnifyCommandRequest): Promise<MagnifyCommandResponse> => {
    return await ipcRenderer.invoke(MAGNIFY_IPC_CHANNELS.MAGNIFY_COMMAND, command);
  },
};

contextBridge.exposeInMainWorld("ipc", ipc);
