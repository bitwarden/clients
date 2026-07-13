import { ipcRenderer } from "electron";

import { DesktopAutofillPreload } from "./desktop-autofill.preload";
import { AutotypeConfig } from "./models/autotype-config";
import { AutotypeMatchError } from "./models/autotype-errors";
import { AutotypeVaultData } from "./models/autotype-vault-data";
import { AUTOTYPE_IPC_CHANNELS, SSH_AGENT_IPC_CHANNELS } from "./models/ipc-channels";

const sshAgent = {
  init: async (useV2: boolean) => {
    await ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.INIT, { useV2 });
  },
  replace: (keys: { name: string; privateKey: string; cipherId: string }[]): Promise<void> =>
    ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.REPLACE, keys),
  signRequestResponse: async (requestId: number, accepted: boolean) => {
    await ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST_RESPONSE, { requestId, accepted });
  },
  listRequestResponse: async (requestId: number, accepted: boolean) => {
    await ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.LIST_KEYS_RESPONSE, { requestId, accepted });
  },
  // V1, delete with PM-30758
  lock: async () => {
    return await ipcRenderer.invoke("sshagent.lock");
  },
  // V1, delete with PM-30758
  clearKeys: async () => {
    return await ipcRenderer.invoke("sshagent.clearkeys");
  },
  isLoaded(): Promise<boolean> {
    return ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.IS_LOADED);
  },
  stop: async () => ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.STOP),
};

export default {
  desktopAutofill: DesktopAutofillPreload,

  sshAgent,

  // Autotype methods
  configureAutotype: (config: AutotypeConfig) => {
    ipcRenderer.send(AUTOTYPE_IPC_CHANNELS.CONFIGURE, config);
  },
  toggleAutotype: (enable: boolean) => {
    ipcRenderer.send(AUTOTYPE_IPC_CHANNELS.TOGGLE, enable);
  },
  listenAutotypeRequest: (
    fn: (
      windowTitle: string,
      completeCallback: (error: Error | null, response: AutotypeVaultData | null) => void,
    ) => void,
  ) => {
    ipcRenderer.on(
      AUTOTYPE_IPC_CHANNELS.LISTEN,
      (
        _event,
        data: {
          windowTitle: string;
        },
      ) => {
        const { windowTitle } = data;

        fn(windowTitle, (error, vaultData) => {
          if (error) {
            const matchError: AutotypeMatchError = {
              windowTitle,
              errorMessage: error.message,
            };
            ipcRenderer.send(AUTOTYPE_IPC_CHANNELS.EXECUTION_ERROR, matchError);
            return;
          }

          if (vaultData !== null) {
            ipcRenderer.send(AUTOTYPE_IPC_CHANNELS.EXECUTE, vaultData);
          }
        });
      },
    );
  },
};
