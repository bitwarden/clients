import { ipcRenderer } from "electron";

import { DesktopAutofillPreload } from "./desktop-autofill.preload";
import { AutotypeConfig } from "./models/autotype-config";
import { AutotypeMatchError } from "./models/autotype-errors";
import { AutotypeVaultData } from "./models/autotype-vault-data";
import { AUTOTYPE_MVP_IPC_CHANNELS, SSH_AGENT_IPC_CHANNELS } from "./models/ipc-channels";

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

// Holds the listener for AUTOTYPE_MVP_IPC_CHANNELS.LISTEN, if
// any, so it can easily be removed rather than clearing the whole channel.
// MVP, delete with PM-41067
let autotypeRequestMvpHandler: Parameters<typeof ipcRenderer.on>[1] | null = null;

// Unbinds the listener registered by listenAutotypeRequestMvp, if any.
// Callers must invoke this whenever Autotype MVP is no longer the active
// implementation, so a stale handler doesn't outlive its authorization.
// MVP, delete with PM-41067
function stopListeningAutotypeRequestMvp() {
  if (autotypeRequestMvpHandler != null) {
    ipcRenderer.removeListener(AUTOTYPE_MVP_IPC_CHANNELS.LISTEN, autotypeRequestMvpHandler);
    autotypeRequestMvpHandler = null;
  }
}

export default {
  desktopAutofill: DesktopAutofillPreload,

  sshAgent,

  // Autotype methods
  // MVP, delete with PM-41067
  configureAutotypeMvp: (config: AutotypeConfig) => {
    ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.CONFIGURE, config);
  },
  toggleAutotypeMvp: (enable: boolean) => {
    ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.TOGGLE, enable);
  },
  listenAutotypeRequestMvp: (
    fn: (
      windowTitle: string,
      completeCallback: (error: Error | null, response: AutotypeVaultData | null) => void,
    ) => void,
  ) => {
    // Registration must be idempotent: `ipcRenderer.on` appends listeners, so
    // remove any previous binding before adding a new one. This prevents multiple
    // autotype mvp listeners. Without this, callers that re-register (for example,
    // on every vault unlock) would stack the autotype listeners unintentionally.
    stopListeningAutotypeRequestMvp();

    autotypeRequestMvpHandler = (
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
          ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.EXECUTION_ERROR, matchError);
          return;
        }

        if (vaultData !== null) {
          ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.EXECUTE, vaultData);
        }
      });
    };

    ipcRenderer.on(AUTOTYPE_MVP_IPC_CHANNELS.LISTEN, autotypeRequestMvpHandler);
  },
  stopListeningAutotypeRequestMvp,
};
