import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { autofill } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../main/window.main";
import { AutofillCommandDefinition } from "../models/autofill-command";
import {
  AutofillIpcChannelControl,
  AutofillIpcChannelIncoming,
  AutofillIpcChannelOutgoing,
  AutofillIpcDefinitionMap,
  AutofillIpcRequest,
  AutofillIpcResponse,
} from "../models/autofill-ipc-channels";

import AutofillIpcServer = autofill.AutofillIpcServer;

type BufferedMessage = {
  channel: string;
  data: any;
};

export type RunCommandParams<C extends AutofillCommandDefinition> = {
  namespace: C["namespace"];
  command: C["name"];
  params: C["input"];
};

export type RunCommandResult<C extends AutofillCommandDefinition> = C["output"];

type Listener<Request> = {
  (error: null, clientId: number, sequenceNumber: number, request: Request): void;
  (error: Error, clientId: number, sequenceNumber: number, request: null): void;
};
type CompletionCallback<Response> = (
  clientId: number,
  sequenceNumber: number,
  response: Response,
) => void;

export class DesktopAutofillMain {
  private ipcServer?: AutofillIpcServer;
  private messageBuffer: BufferedMessage[] = [];
  private listenerReady = false;
  private completionCallbacks: Map<string, CompletionCallback<any>> = new Map();

  constructor(
    private logService: LogService,
    private windowMain: WindowMain,
  ) {}

  /**
   * Safely sends a message to the renderer, buffering it if the server isn't ready yet
   */
  private safeSend(channel: string, data: any) {
    if (this.listenerReady && this.windowMain.win?.webContents) {
      this.windowMain.win.webContents.send(channel, data);
    } else {
      this.messageBuffer.push({ channel, data });
    }
  }

  /**
   * Flushes all buffered messages to the renderer
   */
  private flushMessageBuffer() {
    if (!this.windowMain.win?.webContents) {
      this.logService.error("Cannot flush message buffer - window not available");
      return;
    }

    this.logService.info(`Flushing ${this.messageBuffer.length} buffered messages`);

    for (const { channel, data } of this.messageBuffer) {
      this.windowMain.win.webContents.send(channel, data);
    }

    this.messageBuffer = [];
  }

  async init() {
    ipcMain.handle(
      AutofillIpcChannelControl.RunCommand,
      <C extends AutofillCommandDefinition>(
        _event: any,
        params: RunCommandParams<C>,
      ): Promise<RunCommandResult<C>> => {
        return this.runCommand(params);
      },
    );

    // Register IPC listeners and response callbacks
    const registrationCallback = this.makeListener(
      AutofillIpcChannelIncoming.PasskeyRegistration,
      AutofillIpcChannelOutgoing.PasskeyRegistration,
      AutofillIpcServer.prototype.completeRegistration,
    );
    const assertionCallback = this.makeListener(
      AutofillIpcChannelIncoming.PasskeyAssertion,
      AutofillIpcChannelOutgoing.PasskeyAssertion,
      AutofillIpcServer.prototype.completeAssertion,
    );
    const assertionWithoutUserInterfaceCallback = this.makeListener(
      AutofillIpcChannelIncoming.PasskeyAssertionWithoutUserInterface,
      AutofillIpcChannelOutgoing.PasskeyAssertion,
      AutofillIpcServer.prototype.completeAssertion,
    );
    const nativeStatusCallback = this.makeListener(AutofillIpcChannelIncoming.NativeStatus);

    this.ipcServer = await AutofillIpcServer.listen("af", {
      registrationCallback,
      assertionCallback,
      assertionWithoutUserInterfaceCallback,
      nativeStatusCallback,
    });

    ipcMain.on(AutofillIpcChannelControl.ListenerReady, () => {
      this.listenerReady = true;
      this.logService.info(
        `Listener is ready, flushing ${this.messageBuffer.length} buffered messages`,
      );
      this.flushMessageBuffer();
    });

    ipcMain.on(AutofillIpcChannelOutgoing.Error, (event, data) => {
      this.logService.debug("[DesktopAutofillMain]", AutofillIpcChannelOutgoing.Error, data);
      const { clientId, sequenceNumber, error } = data;
      this.ipcServer?.completeError(clientId, sequenceNumber, String(error));
    });
  }

  /**
   * Creates a listener function for an autofill IPC request, and selects a Electron
   * renderer IPC channel to forward the request to. If a response callback is
   * given, also registers a Electron channel listener for the response from the
   * renderer process, which is forwarded back to the autofill IPC server using
   * the given completion callback.
   *
   * @param {string} toRendererChannel - Channel to send requests to the renderer process.
   * @param {[string]} fromRendererChannel - Channel to listen for responses from the renderer process. Excluded if the IPC request does not expect a response.
   * @param {[string]} completeCallback - Callback to execute on a response from the renderer process. This should be a reference to a prototype method on {@link AutofillIpcServer}. Excluded if the IPC request does not expect a response.
   *
   * @returns A callback that can be used to register with {@link AutofillIpcServer.listen}.
   */
  private makeListener<K extends AutofillIpcChannelIncoming>(
    toRendererChannel: K,
    fromRendererChannel?: AutofillIpcDefinitionMap[K]["outgoing"],
    completeCallback?: CompletionCallback<AutofillIpcResponse<K>>,
  ): Listener<AutofillIpcRequest<K>> {
    const callback: Listener<AutofillIpcRequest<K>> = (
      error,
      clientId,
      sequenceNumber,
      request,
    ) => {
      if (error) {
        this.logService.error("[NativeAutofillMain]", `${toRendererChannel}:`, error);
        this.ipcServer?.completeError(clientId, sequenceNumber, String(error));
        return;
      }

      this.safeSend(toRendererChannel, {
        clientId,
        sequenceNumber,
        request,
      });
    };

    // Only register if we have a callback, and only once
    if (completeCallback && fromRendererChannel) {
      if (ipcMain.listenerCount(fromRendererChannel) > 0) {
        if (completeCallback === this.completionCallbacks.get(fromRendererChannel)) {
          // if we're registering the same handler for the channel, then just silently continue.
          return callback;
        } else {
          throw new Error(
            `Tried to register multiple listeners for ${fromRendererChannel}, which is not allowed.`,
          );
        }
      }

      ipcMain.on(fromRendererChannel, (_event, data) => {
        // This will only happen if we forget to assign `this.ipcServer`, since
        // we won't receive any requests unless AutofillIpcServer.listen() is
        // called, and therefore, we won't receive any response callbacks
        // without ipcServer being set.
        if (!this.ipcServer) {
          this.logService.error(
            "[NativeAutofillMain]",
            `${fromRendererChannel}: Cannot find IPC server instance to return response to autofill provider.`,
          );
          throw new Error(
            "Received data to send to Autofill IPC, but the IPC client instance is not initialized.",
          );
        }

        this.logService.debug(fromRendererChannel, data);
        const { clientId, sequenceNumber, response } = data;
        completeCallback.call(this.ipcServer, clientId, sequenceNumber, response);
      });

      this.completionCallbacks.set(fromRendererChannel, completeCallback);
    }

    return callback;
  }

  private async runCommand<C extends AutofillCommandDefinition>(
    command: RunCommandParams<C>,
  ): Promise<RunCommandResult<C>> {
    try {
      const result = await autofill.runCommand(JSON.stringify(command));
      const parsed = JSON.parse(result) as RunCommandResult<C>;

      if (parsed.type === "error") {
        this.logService.error(`Error running autofill command '${command.command}':`, parsed.error);
      }

      return parsed;
    } catch (e) {
      this.logService.error(`Error running autofill command '${command.command}':`, e);

      if (e instanceof Error) {
        return { type: "error", error: e.stack ?? String(e) } as RunCommandResult<C>;
      }

      return { type: "error", error: String(e) } as RunCommandResult<C>;
    }
  }
}
