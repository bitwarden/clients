import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/process-reload";

export class WebProcessReloadService implements ProcessReloadServiceAbstraction {
  constructor(private window: Window) {}

  async reloadProcess(): Promise<void> {
    this.window.location.reload();
  }
}
