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
import {
  AutofillIpcChannelControl,
  AutofillIpcChannelIncoming,
  AutofillIpcChannelOutgoing,
} from "./models/autofill-ipc-channels";
import { CompletionCallback, IpcListener } from "./models/ipc-handler.type";

export const DesktopAutofillPreload = {
  runCommand: <C extends AutofillCommand>(
    params: RunCommandParams<C>,
  ): Promise<RunCommandResult<C>> =>
    ipcRenderer.invoke(AutofillIpcChannelControl.RunCommand, params),

  listenerReady: () => ipcRenderer.send("autofill.listenerReady"),

  listenPasskeyRegistration: makeListener<PasskeyRegistrationRequest, PasskeyRegistrationResponse>(
    AutofillIpcChannelIncoming.PasskeyRegistration,
    AutofillIpcChannelOutgoing.PasskeyRegistration,
  ),
  listenPasskeyAssertion: makeListener<PasskeyAssertionRequest, PasskeyAssertionResponse>(
    AutofillIpcChannelIncoming.PasskeyAssertion,
    AutofillIpcChannelOutgoing.PasskeyAssertion,
  ),

  listenPasskeyAssertionWithoutUserInterface: makeListener<
    PasskeyAssertionWithoutUserInterfaceRequest,
    PasskeyAssertionResponse
  >(
    AutofillIpcChannelIncoming.PasskeyAssertionWithoutUserInterface,
    AutofillIpcChannelOutgoing.PasskeyAssertion,
  ),

  listenNativeStatus: makeListener<NativeStatus, void>(AutofillIpcChannelIncoming.NativeStatus),
};

function makeListener<Request, Response>(
  incomingChannel: AutofillIpcChannelIncoming,
  outgoingChannel?: AutofillIpcChannelOutgoing,
) {
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
                ipcRenderer.send(AutofillIpcChannelOutgoing.Error, {
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
