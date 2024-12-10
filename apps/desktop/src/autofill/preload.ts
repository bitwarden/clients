import { ipcRenderer } from "electron";

import { Command } from "../platform/main/autofill/command";
import { RunCommandParams, RunCommandResult } from "../platform/main/autofill/native-autofill.main";

export default {
  runCommand: <C extends Command>(params: RunCommandParams<C>): Promise<RunCommandResult<C>> =>
    ipcRenderer.invoke("autofill.runCommand", params),
};
