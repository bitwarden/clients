import { ipcMain } from "electron";

/**
 * The ephemeral value store holds values that should be accessible to the renderer past a process reload.
 * In the current state, no keys, that alone can be used to decrypt a vault should be kept in this store.
 */
export class EphemeralValueStorageService {
  private ephemeralValues = new Map<string, string>();

  constructor() {
    ipcMain.handle("setEphemeralValue", async (event, { key, value }) => {
      this.ephemeralValues.set(key, value);
    });
    ipcMain.handle("getEphemeralValue", async (event, key: string) => {
      return this.ephemeralValues.get(key);
    });
    ipcMain.handle("deleteEphemeralValue", async (event, key: string) => {
      this.ephemeralValues.delete(key);
    });
  }
}
