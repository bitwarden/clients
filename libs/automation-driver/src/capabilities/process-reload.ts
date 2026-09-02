import { AutomationCapability } from "../automation-capability";

/** Client-supplied process reload, e.g. `location.reload()` or an IPC call to the main process. */
export type ReloadProcess = () => Promise<void> | void;

/** Reloads the client process. Only wired on clients that can reload themselves. */
export class ProcessReloadCapability implements AutomationCapability {
  readonly automationName = "processReload";

  constructor(private reloadProcess: ReloadProcess) {}

  async reload(): Promise<void> {
    await this.reloadProcess();
  }
}
