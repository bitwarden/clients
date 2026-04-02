import { Router } from "@angular/router";

import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/abstractions/process-reload.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

export class WebProcessReloadService implements ProcessReloadServiceAbstraction {
  constructor(
    private window: Window,
    private platformUtilsService: PlatformUtilsService,
    private router: Router,
  ) {}

  async startProcessReload(): Promise<void> {
    if (!this.platformUtilsService.isDev()) {
      this.window.location.reload();
    } else {
      await this.router.navigate(["/"]);
    }
  }

  cancelProcessReload(): void {
    return;
  }
}
