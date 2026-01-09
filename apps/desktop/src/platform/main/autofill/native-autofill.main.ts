import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { autofill } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../../main/window.main";

import { CommandDefinition } from "./command";
import { HostRequestDefinition } from "./request";

type BufferedMessage = {
  channel: string;
  data: any;
};

export type RunCommandParams<C extends CommandDefinition> = {
  namespace: C["namespace"];
  command: C["name"];
  params: C["input"];
};

export type RunCommandResult<C extends CommandDefinition> = C["output"];

export type HostRequestParams<R extends HostRequestDefinition> = {
  namespace: R["namespace"];
  command: R["name"];
  params: R["input"];
};

export type HostRequestResult<R extends HostRequestDefinition> = R["output"];

export class NativeAutofillMain {
  private ipcServer?: autofill.AutofillIpcServer;
  private messageBuffer: BufferedMessage[] = [];
  private listenerReady = false;

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
      "autofill.runCommand",
      <C extends CommandDefinition>(
        _event: any,
        params: RunCommandParams<C>,
      ): Promise<RunCommandResult<C>> => {
        return this.runCommand(params);
      },
    );

    ipcMain.handle(
      "autofill.userVerification",
      (
        _event: any,
        params: autofill.UserVerificationRequest,
      ): Promise<autofill.UserVerificationResponse> =>{
        return this.ipcServer.verifyUser(params)
      });

    this.ipcServer = await autofill.AutofillIpcServer.listen(
      "af",
      // RegistrationCallback
      (error, clientId, sequenceNumber, request) => {
        if (error) {
          this.logService.error("autofill.IpcServer.registration", error);
          this.ipcServer?.completeError(clientId, sequenceNumber, String(error));
          return;
        }
        this.safeSend("autofill.passkeyRegistration", {
          clientId,
          sequenceNumber,
          request,
        });
      },
      // AssertionCallback
      (error, clientId, sequenceNumber, request) => {
        if (error) {
          this.logService.error("autofill.IpcServer.assertion", error);
          this.ipcServer?.completeError(clientId, sequenceNumber, String(error));
          return;
        }
        this.safeSend("autofill.passkeyAssertion", {
          clientId,
          sequenceNumber,
          request,
        });
      },
      // AssertionWithoutUserInterfaceCallback
      (error, clientId, sequenceNumber, request) => {
        if (error) {
          this.logService.error("autofill.IpcServer.assertion", error);
          this.ipcServer?.completeError(clientId, sequenceNumber, String(error));
          return;
        }
        this.safeSend("autofill.passkeyAssertionWithoutUserInterface", {
          clientId,
          sequenceNumber,
          request,
        });
      },
      // NativeStatusCallback
      (error, clientId, sequenceNumber, status) => {
        if (error) {
          this.logService.error("autofill.IpcServer.nativeStatus", error);
          this.ipcServer?.completeError(clientId, sequenceNumber, String(error));
          return;
        }
        this.safeSend("autofill.nativeStatus", {
          clientId,
          sequenceNumber,
          status,
        });
      },
      // WindowHandleQueryCallback
      (error, clientId, sequenceNumber, request) => {
        if (error) {
          this.logService.error("autofill.IpcServer.windowHandleQuery", error);
          this.ipcServer.completeError(clientId, sequenceNumber, String(error));
          return;
        }
        this.safeSend("autofill.windowHandleQuery", {
          clientId,
          sequenceNumber,
          request,
        });
      },
    );

    ipcMain.on("autofill.listenerReady", () => {
      this.listenerReady = true;
      this.logService.info(
        `Listener is ready, flushing ${this.messageBuffer.length} buffered messages`,
      );
      this.flushMessageBuffer();
    });

    ipcMain.on("autofill.completePasskeyRegistration", (event, data) => {
      this.logService.debug("autofill.completePasskeyRegistration", data);
      const { clientId, sequenceNumber, response } = data;
      this.ipcServer?.completeRegistration(clientId, sequenceNumber, response);
    });

    ipcMain.on("autofill.completePasskeyAssertion", (event, data) => {
      this.logService.debug("autofill.completePasskeyAssertion", data);
      const { clientId, sequenceNumber, response } = data;
      this.ipcServer?.completeAssertion(clientId, sequenceNumber, response);
    });

    ipcMain.on("autofill.completeWindowHandleQuery", (event, data) => {
      this.logService.debug("autofill.completeWindowHandleQuery", data);
      const { clientId, sequenceNumber, response } = data;
      this.ipcServer.completeWindowHandleQuery(clientId, sequenceNumber, response);
    });

    ipcMain.on("autofill.completeError", (event, data) => {
      this.logService.debug("autofill.completeError", data);
      const { clientId, sequenceNumber, error } = data;
      this.ipcServer?.completeError(clientId, sequenceNumber, String(error));
    });
  }

  private async runCommand<C extends CommandDefinition>(
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
