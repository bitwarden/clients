import { ipcRenderer } from "electron";

import { RunCommandParams, RunCommandResult } from "./main/main-desktop-autofill.service";
import { AutofillCommand } from "./models/autofill-command";
import {
  AutofillIpcChannelControl,
  AutofillIpcChannelIncoming,
  AutofillIpcChannelOutgoing,
  AutofillIpcDefinitionMap,
  AutofillIpcRequest,
  AutofillIpcResponse,
} from "./models/autofill-ipc-channels";
import { CompletionCallback, IpcListener } from "./models/ipc-handler.type";

export const DesktopAutofillPreload = {
  runCommand: <C extends AutofillCommand>(
    params: RunCommandParams<C>,
  ): Promise<RunCommandResult<C>> =>
    ipcRenderer.invoke(AutofillIpcChannelControl.RunCommand, params),

  listenerReady: () => ipcRenderer.send("autofill.listenerReady"),

  listenPasskeyRegistration: makeListener(
    AutofillIpcChannelIncoming.PasskeyRegistration,
    AutofillIpcChannelOutgoing.PasskeyRegistration,
  ),
  listenPasskeyAssertion: makeListener(
    AutofillIpcChannelIncoming.PasskeyAssertion,
    AutofillIpcChannelOutgoing.PasskeyAssertion,
  ),

  listenPasskeyAssertionWithoutUserInterface: makeListener(
    AutofillIpcChannelIncoming.PasskeyAssertionWithoutUserInterface,
    AutofillIpcChannelOutgoing.PasskeyAssertion,
  ),

  listenNativeStatus: makeListener(AutofillIpcChannelIncoming.NativeStatus),
};

function makeListener<K extends AutofillIpcChannelIncoming>(
  incomingChannel: K,
  outgoingChannel?: AutofillIpcDefinitionMap[K]["outgoing"],
) {
  return (fn: IpcListener<AutofillIpcRequest<K>, AutofillIpcResponse<K>>) => {
    ipcRenderer.on(
      incomingChannel,
      (
        _event,
        data: {
          clientId: number;
          sequenceNumber: number;
          request: AutofillIpcRequest<K>;
        },
      ) => {
        const { clientId, sequenceNumber, request } = data;
        const completeCallback: CompletionCallback<AutofillIpcResponse<K>> | undefined =
          outgoingChannel
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
