import { ipcRenderer } from "electron";

import type { autofill } from "@bitwarden/desktop-napi";

import { RunCommandParams, RunCommandResult } from "./main/main-desktop-autofill.service";
import { AutofillCommand } from "./models/autofill-command";

type CompletionCallback<T> = {
  (error: null, response: T): void;
  (error: Error, response: null): void;
};

export const DesktopAutofillPreload = {
  runCommand: <C extends AutofillCommand>(
    params: RunCommandParams<C>,
  ): Promise<RunCommandResult<C>> => ipcRenderer.invoke("autofill.runCommand", params),

  listenerReady: () => ipcRenderer.send("autofill.listenerReady"),

  listenPasskeyRegistration: (
    fn: (
      clientId: number,
      sequenceNumber: number,
      request: autofill.PasskeyRegistrationRequest,
      completeCallback: CompletionCallback<autofill.PasskeyRegistrationResponse>,
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
      completeCallback: CompletionCallback<autofill.PasskeyAssertionResponse>,
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
      completeCallback: CompletionCallback<autofill.PasskeyAssertionResponse>,
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
};
