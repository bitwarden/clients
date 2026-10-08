import { ipcRenderer } from "electron";

import { DesktopAutofillPreload } from "./desktop-autofill.preload";
import { AgentFillApprovalResponse } from "./models/agent-fill-approval";
import {
  AgentFillConnectionView,
  CreatedAgentFillConnection,
} from "./models/agent-fill-connection";
import { AutotypeConfig } from "./models/autotype-config";
import { AutotypeMatchError } from "./models/autotype-errors";
import { AutotypeVaultData } from "./models/autotype-vault-data";
import {
  AGENT_FILL_IPC_CHANNELS,
  AUTOTYPE_MVP_IPC_CHANNELS,
  SSH_AGENT_IPC_CHANNELS,
} from "./models/ipc-channels";

const sshAgent = {
  init: async () => {
    await ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.INIT);
  },
  replace: (keys: { name: string; privateKey: string; cipherId: string }[]): Promise<void> =>
    ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.REPLACE, keys),
  signRequestResponse: async (requestId: number, accepted: boolean) => {
    await ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST_RESPONSE, { requestId, accepted });
  },
  listRequestResponse: async (requestId: number, accepted: boolean) => {
    await ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.LIST_KEYS_RESPONSE, { requestId, accepted });
  },
  isLoaded(): Promise<boolean> {
    return ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.IS_LOADED);
  },
  stop: async () => ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.STOP),
};

const agentFill = {
  approvalResponse: (requestId: string, response: AgentFillApprovalResponse): Promise<void> =>
    ipcRenderer.invoke(AGENT_FILL_IPC_CHANNELS.APPROVAL_RESPONSE, { requestId, response }),
  connections: {
    list: (): Promise<AgentFillConnectionView[]> =>
      ipcRenderer.invoke(AGENT_FILL_IPC_CHANNELS.CONNECTIONS_LIST),
    create: (name: string): Promise<CreatedAgentFillConnection> =>
      ipcRenderer.invoke(AGENT_FILL_IPC_CHANNELS.CONNECTIONS_CREATE, name),
    pause: (id: string): Promise<void> =>
      ipcRenderer.invoke(AGENT_FILL_IPC_CHANNELS.CONNECTIONS_PAUSE, id),
    resume: (id: string): Promise<void> =>
      ipcRenderer.invoke(AGENT_FILL_IPC_CHANNELS.CONNECTIONS_RESUME, id),
    remove: (id: string): Promise<void> =>
      ipcRenderer.invoke(AGENT_FILL_IPC_CHANNELS.CONNECTIONS_REMOVE, id),
  },
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

  agentFill,

  autotypeMvp,
};
