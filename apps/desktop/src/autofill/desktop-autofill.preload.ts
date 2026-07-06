import { ipcRenderer } from "electron";

import type { autofill } from "@bitwarden/desktop-napi";

import { RunCommandParams, RunCommandResult } from "./main/main-desktop-autofill.service";
import { AutofillCommand } from "./models/autofill-command";

type CompletionCallback<T> = {
  (error: null, response: T): void;
  (error: Error, response: null): void;
};

type IpcListener<Request, Response> = (
  clientId: number,
  sequenceNumber: number,
  request: Request,
  completeCallback: CompletionCallback<Response>,
) => void;

export const DesktopAutofillPreload = {
  runCommand: <C extends AutofillCommand>(
    params: RunCommandParams<C>,
  ): Promise<RunCommandResult<C>> => ipcRenderer.invoke("autofill.runCommand", params),

  listenerReady: () => ipcRenderer.send("autofill.listenerReady"),

  listenPasskeyRegistration: (
    fn: IpcListener<autofill.PasskeyRegistrationRequest, autofill.PasskeyRegistrationResponse>,
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
    fn: IpcListener<autofill.PasskeyAssertionRequest, autofill.PasskeyAssertionResponse>,
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
    fn: IpcListener<
      autofill.PasskeyAssertionWithoutUserInterfaceRequest,
      autofill.PasskeyAssertionResponse
    >,
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
    fn: (clientId: number, sequenceNumber: number, request: autofill.NativeStatus) => void,
  ) => {
    ipcRenderer.on(
      "autofill.nativeStatus",
      (
        event,
        data: {
          clientId: number;
          sequenceNumber: number;
          request: autofill.NativeStatus;
        },
      ) => {
        const { clientId, sequenceNumber, request } = data;
        fn(clientId, sequenceNumber, request);
      },
    );
  },
};
