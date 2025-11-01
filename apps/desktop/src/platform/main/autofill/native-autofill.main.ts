import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { autofill } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../../main/window.main";

import { CommandDefinition } from "./command";
import { NativeAutofillWindowsMain } from "./native-autofill.windows.main";

export type RunCommandParams<C extends CommandDefinition> = {
  namespace: C["namespace"];
  command: C["name"];
  params: C["input"];
};

export type RunCommandResult<C extends CommandDefinition> = C["output"];

export class NativeAutofillMain {
  private ipcServer: autofill.IpcServer | null;
  private windowsMain: NativeAutofillWindowsMain;

  constructor(
    private logService: LogService,
    private windowMain: WindowMain,
  ) {
    this.windowsMain = new NativeAutofillWindowsMain(logService, windowMain);
  }

  async init() {
    const enableWindowsPasskeyProvider = true;
    if (enableWindowsPasskeyProvider) {
      this.windowsMain.initWindows();
      this.windowsMain.setupWindowsRendererIPCHandlers();
    }

    ipcMain.handle(
      "autofill.runCommand",
      <C extends CommandDefinition>(
        _event: any,
        params: RunCommandParams<C>,
      ): Promise<RunCommandResult<C>> => {
        return this.runCommand(params);
      },
    );

    this.ipcServer = await autofill.IpcServer.listen(
      "af",
      // RegistrationCallback
      (error, clientId, sequenceNumber, request) => {
        if (error) {
          this.logService.error("autofill.IpcServer.registration", error);
          this.ipcServer.completeError(clientId, sequenceNumber, String(error));
          return;
        }
        this.windowMain.win.webContents.send("autofill.passkeyRegistration", {
          clientId,
          sequenceNumber,
          request,
        });
      },
      // AssertionCallback
      (error, clientId, sequenceNumber, request) => {
        if (error) {
          this.logService.error("autofill.IpcServer.assertion", error);
          this.ipcServer.completeError(clientId, sequenceNumber, String(error));
          return;
        }
        this.windowMain.win.webContents.send("autofill.passkeyAssertion", {
          clientId,
          sequenceNumber,
          request,
        });
      },
      // AssertionWithoutUserInterfaceCallback
      (error, clientId, sequenceNumber, request) => {
        if (error) {
          this.logService.error("autofill.IpcServer.assertion", error);
          this.ipcServer.completeError(clientId, sequenceNumber, String(error));
          return;
        }
        this.windowMain.win.webContents.send("autofill.passkeyAssertionWithoutUserInterface", {
          clientId,
          sequenceNumber,
          request,
        });
      },
    );

    ipcMain.on("autofill.completePasskeyRegistration", (event, data) => {
      this.logService.warning("autofill.completePasskeyRegistration", data);
      const { clientId, sequenceNumber, response } = data;
      this.ipcServer.completeRegistration(clientId, sequenceNumber, response);
    });

    ipcMain.on("autofill.completePasskeyAssertion", (event, data) => {
      this.logService.warning("autofill.completePasskeyAssertion", data);
      const { clientId, sequenceNumber, response } = data;
      this.ipcServer.completeAssertion(clientId, sequenceNumber, response);
    });

    ipcMain.on("autofill.completeError", (event, data) => {
      this.logService.warning("autofill.completeError", data);
      const { clientId, sequenceNumber, error } = data;
      this.ipcServer.completeError(clientId, sequenceNumber, String(error));
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
