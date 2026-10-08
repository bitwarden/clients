import { ipcRenderer } from "electron";

import { DesktopAutofillPreload } from "./desktop-autofill.preload";
import { AgentOutcome } from "./models/agent-request";
import { AutotypeConfig } from "./models/autotype-config";
import { AutotypeMatchError } from "./models/autotype-errors";
import { AutotypeVaultData } from "./models/autotype-vault-data";
import {
  AGENT_ACCESS_IPC_CHANNELS,
  AUTOTYPE_MVP_IPC_CHANNELS,
  SSH_AGENT_IPC_CHANNELS,
} from "./models/ipc-channels";

const sshAgent = {
  init: async () => {
    await ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.INIT);
  },
  replace: (keys: { name: string; privateKey: string; cipherId: string }[]): Promise<void> =>
    ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.REPLACE, keys),
  ready: (): Promise<void> => ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.READY),
  listRequestResponse: async (requestId: number, accepted: boolean) => {
    await ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.LIST_KEYS_RESPONSE, { requestId, accepted });
  },
  isLoaded(): Promise<boolean> {
    return ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.IS_LOADED);
  },
  stop: async () => ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.STOP),
};

const agentAccess = {
  init: (): Promise<void> => ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.INIT),
  isLoaded: (): Promise<boolean> => ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.IS_LOADED),
  stop: (): Promise<void> => ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.STOP),
  ready: (): Promise<void> => ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.READY),
  respond: (requestId: number, outcome: AgentOutcome): Promise<void> =>
    ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.RESPONSE, { requestId, outcome }),
};

// MVP, delete with PM-41067
const autotypeMvp = {
  configure: (config: AutotypeConfig) => {
    ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.CONFIGURE, config);
  },
  toggle: (enable: boolean) => {
    ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.TOGGLE, enable);
  },
  listenRequest: (
    fn: (
      windowTitle: string,
      completeCallback: (error: Error | null, response: AutotypeVaultData | null) => void,
    ) => void,
  ) => {
    ipcRenderer.on(
      AUTOTYPE_MVP_IPC_CHANNELS.LISTEN,
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
            ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.EXECUTION_ERROR, matchError);
            return;
          }

          if (vaultData !== null) {
            ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.EXECUTE, vaultData);
          }
        });
      },
    );
  },
};

export default {
  desktopAutofill: DesktopAutofillPreload,

  sshAgent,

  agentAccess,

  autotypeMvp,
};
