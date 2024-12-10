import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { autofill } from "@bitwarden/desktop-napi";

import { CommandDefinition } from "./command";

export type RunCommandParams<C extends CommandDefinition> = {
  namespace: C["namespace"];
  command: C["name"];
  params: C["input"];
};

export type RunCommandResult<C extends CommandDefinition> = C["output"];

export class NativeAutofillMain {
  constructor(private logService: LogService) {}

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
