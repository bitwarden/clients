import { ipcRenderer } from "electron";

import type { autofill } from "@bitwarden/desktop-napi";
type PasskeyAssertionRequest = autofill.PasskeyAssertionRequest;
type PasskeyAssertionResponse = autofill.PasskeyAssertionResponse;
type PasskeyAssertionWithoutUserInterfaceRequest =
  autofill.PasskeyAssertionWithoutUserInterfaceRequest;
type PasskeyRegistrationRequest = autofill.PasskeyRegistrationRequest;
type PasskeyRegistrationResponse = autofill.PasskeyRegistrationResponse;
type NativeStatus = autofill.NativeStatus;

import { RunCommandParams, RunCommandResult } from "./main/main-desktop-autofill.service";
import { AutofillCommand } from "./models/autofill-command";
import { CompletionCallback, IpcListener } from "./models/ipc-handler.type";

export const DesktopAutofillPreload = {
  runCommand: <C extends AutofillCommand>(
    params: RunCommandParams<C>,
  ): Promise<RunCommandResult<C>> => ipcRenderer.invoke("autofill.runCommand", params),

  listenerReady: () => ipcRenderer.send("autofill.listenerReady"),

  listenPasskeyRegistration: makeListener<PasskeyRegistrationRequest, PasskeyRegistrationResponse>(
    "autofill.passkeyRegistration",
    "autofill.completePasskeyRegistration",
  ),

  listenPasskeyAssertion: makeListener<PasskeyAssertionRequest, PasskeyAssertionResponse>(
    "autofill.passkeyAssertion",
    "autofill.completePasskeyAssertion",
  ),

  listenPasskeyAssertionWithoutUserInterface: makeListener<
    PasskeyAssertionWithoutUserInterfaceRequest,
    PasskeyAssertionResponse
  >("autofill.passkeyAssertionWithoutUserInterface", "autofill.completePasskeyAssertion"),

  listenNativeStatus: makeListener<NativeStatus, void>("autofill.nativeStatus"),
};

function makeListener<Request, Response>(incomingChannel: string, outgoingChannel?: string) {
  return (fn: IpcListener<Request, Response>) => {
    ipcRenderer.on(
      incomingChannel,
      (
        _event,
        data: {
          clientId: number;
          sequenceNumber: number;
          request: Request;
        },
      ) => {
        const { clientId, sequenceNumber, request } = data;
        const completeCallback: CompletionCallback<Response> | undefined = outgoingChannel
          ? (error, response) => {
              if (error) {
                ipcRenderer.send("autofill.completeError", {
                  clientId,
                  sequenceNumber,
                  error: error.message,
                });
                return;
              }

              ipcRenderer.send(outgoingChannel, {
                clientId,
                sequenceNumber,
                response,
              });
            }
          : undefined;
        fn(clientId, sequenceNumber, request, completeCallback);
      },
    );
  };
}
