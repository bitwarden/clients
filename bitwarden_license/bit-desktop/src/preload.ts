import { contextBridge } from "electron";

import { ipc as ossIpc } from "@bitwarden/desktop/preload";

/**
 * Bitwarden Preload script.
 *
 * This file extends the OSS IPC with commercial-specific channels.
 *
 * See the OSS preload script for more information.
 */

export const ipc = {
  ...ossIpc,
};

contextBridge.exposeInMainWorld("ipc", ipc);
