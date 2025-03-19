import { contextBridge } from "electron";

import auth from "./auth/preload";
import autofill from "./autofill/preload";
import keyManagement from "./key-management/preload";
import platform from "./platform/preload";

/**
 * Bitwarden Preload script.
 *
 * This file contains the "glue" between the main process and the renderer process. Please ensure
 * that you have read through the following articles before modifying any preload script.
 *
 * https://www.electronjs.org/docs/latest/tutorial/tutorial-preload
 * https://www.electronjs.org/docs/latest/api/context-bridge
 */

// Each team owns a subspace of the `ipc` global variable in the renderer.
export const ipc = {
  auth,
  autofill,
  platform,
  keyManagement,
};

contextBridge.exposeInMainWorld("ipc", ipc);
