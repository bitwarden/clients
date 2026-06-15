import { ipcRenderer } from "electron";

import type { autofill } from "@bitwarden/desktop-napi";

import { Command } from "../platform/main/autofill/command";
import { RunCommandParams, RunCommandResult } from "../platform/main/autofill/native-autofill.main";

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
  sshAgent,
  runCommand: <C extends Command>(params: RunCommandParams<C>): Promise<RunCommandResult<C>> =>
    ipcRenderer.invoke("autofill.runCommand", params),

  listenerReady: () => ipcRenderer.send("autofill.listenerReady"),

  listenPasskeyRegistration: (
    fn: (
      clientId: number,
      sequenceNumber: number,
      request: autofill.PasskeyRegistrationRequest,
      completeCallback: (
        error: Error | null,
        response: autofill.PasskeyRegistrationResponse,
      ) => void,
    ) => void,
  ) => {
    ipcRenderer.on(
      "autofill.passkeyRegistration",
      (
        event,
        data: {
          clientId: number;
          sequenceNumber: number;
          request: autofill.PasskeyRegistrationRequest;
        },
      ) => {
        const { clientId, sequenceNumber, request } = data;
        fn(clientId, sequenceNumber, request, (error, response) => {
          if (error) {
            ipcRenderer.send("autofill.completeError", {
              clientId,
              sequenceNumber,
              error: error.message,
            });
            return;
          }

          ipcRenderer.send("autofill.completePasskeyRegistration", {
            clientId,
            sequenceNumber,
            response,
          });
        });
      },
    );
  },

  listenPasskeyAssertion: (
    fn: (
      clientId: number,
      sequenceNumber: number,
      request: autofill.PasskeyAssertionRequest,
      completeCallback: (error: Error | null, response: autofill.PasskeyAssertionResponse) => void,
    ) => void,
  ) => {
    ipcRenderer.on(
      "autofill.passkeyAssertion",
      (
        event,
        data: {
          clientId: number;
          sequenceNumber: number;
          request: autofill.PasskeyAssertionRequest;
        },
      ) => {
        const { clientId, sequenceNumber, request } = data;
        fn(clientId, sequenceNumber, request, (error, response) => {
          if (error) {
            ipcRenderer.send("autofill.completeError", {
              clientId,
              sequenceNumber,
              error: error.message,
            });
            return;
          }

          ipcRenderer.send("autofill.completePasskeyAssertion", {
            clientId,
            sequenceNumber,
            response,
          });
        });
      },
    );
  },
  listenPasskeyAssertionWithoutUserInterface: (
    fn: (
      clientId: number,
      sequenceNumber: number,
      request: autofill.PasskeyAssertionWithoutUserInterfaceRequest,
      completeCallback: (error: Error | null, response: autofill.PasskeyAssertionResponse) => void,
    ) => void,
  ) => {
    ipcRenderer.on(
      "autofill.passkeyAssertionWithoutUserInterface",
      (
        event,
        data: {
          clientId: number;
          sequenceNumber: number;
          request: autofill.PasskeyAssertionWithoutUserInterfaceRequest;
        },
      ) => {
        const { clientId, sequenceNumber, request } = data;
        fn(clientId, sequenceNumber, request, (error, response) => {
          if (error) {
            ipcRenderer.send("autofill.completeError", {
              clientId,
              sequenceNumber,
              error: error.message,
            });
            return;
          }

          ipcRenderer.send("autofill.completePasskeyAssertion", {
            clientId,
            sequenceNumber,
            response,
          });
        });
      },
    );
  },
  listenNativeStatus: (
    fn: (clientId: number, sequenceNumber: number, status: { key: string; value: string }) => void,
  ) => {
    ipcRenderer.on(
      "autofill.nativeStatus",
      (
        event,
        data: {
          clientId: number;
          sequenceNumber: number;
          status: { key: string; value: string };
        },
      ) => {
        const { clientId, sequenceNumber, status } = data;
        fn(clientId, sequenceNumber, status);
      },
    );
  },
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
