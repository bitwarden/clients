import { ipcRenderer } from "electron";

import { DesktopAutofillPreload } from "./desktop-autofill.preload";
import { AutotypeConfig } from "./models/autotype-config";
import { AutotypeMatchError } from "./models/autotype-errors";
import { AutotypeVaultData } from "./models/autotype-vault-data";
import {
  AUTOTYPE_MVP_IPC_CHANNELS,
  SSH_AGENT_IPC_CHANNELS,
  SSH_AGENT_SETUP_IPC_CHANNELS,
} from "./models/ipc-channels";
import { SshAgentActivity } from "./models/ssh-agent-activity";
import { SshAgentSetupApi } from "./models/ssh-agent-setup";

const sshAgentSetup: SshAgentSetupApi = {
  getEnvironment: () => ipcRenderer.invoke(SSH_AGENT_SETUP_IPC_CHANNELS.GET_ENVIRONMENT),
  getStatus: () => ipcRenderer.invoke(SSH_AGENT_SETUP_IPC_CHANNELS.GET_STATUS),
  getPlan: () => ipcRenderer.invoke(SSH_AGENT_SETUP_IPC_CHANNELS.GET_PLAN),
  apply: (planId: string, stepIds: string[]) =>
    ipcRenderer.invoke(SSH_AGENT_SETUP_IPC_CHANNELS.APPLY, planId, stepIds),
  undo: () => ipcRenderer.invoke(SSH_AGENT_SETUP_IPC_CHANNELS.UNDO),
  verify: () => ipcRenderer.invoke(SSH_AGENT_SETUP_IPC_CHANNELS.VERIFY),
};

const sshAgent = {
  activityLog(): Promise<SshAgentActivity[]> {
    return ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.ACTIVITY_LOG);
  },
  setup: sshAgentSetup,
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

  autotypeMvp,
};
