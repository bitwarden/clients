import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/abstractions/process-reload.service";

export class WebProcessReloadService implements ProcessReloadServiceAbstraction {
  constructor(private window: Window) {}

  async startProcessReload(authService: AuthService): Promise<void> {
    this.window.location.reload();
  }

  cancelProcessReload(): void {
    return;
  }
}
