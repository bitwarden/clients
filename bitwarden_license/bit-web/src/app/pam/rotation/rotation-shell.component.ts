import { ChangeDetectionStrategy, Component, effect, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule, ActivatedRoute } from "@angular/router";
import { map } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";
import { TabsModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { RotationConfigsService } from "./managed-credentials/rotation-configs.service";

/**
 * Rotation feature shell: renders the page header and the three routed tabs
 * (Managed credentials / Target systems / Daemons). The shell stays mounted
 * across tab navigation; the page-scoped services (provided at the shell route)
 * are shared by all tabs.
 *
 * The Managed credentials tab label shows a warning berry when there are
 * configs awaiting a manual rotation confirmation.
 */
@Component({
  selector: "app-rotation-shell",
  templateUrl: "./rotation-shell.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, I18nPipe, HeaderModule, TabsModule],
})
export class RotationShellComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly configsService = inject(RotationConfigsService);

  /** organizationId from the route params (inherited via paramsInheritanceStrategy "always"). */
  protected readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as OrganizationId)),
    { requireSync: true },
  );

  /** Number of configs awaiting a manual rotation confirmation — drives the tab berry. */
  protected readonly awaitingManualCount = toSignal(this.configsService.awaitingManualCount$, {
    initialValue: 0,
  });

  constructor() {
    // Load the configs service whenever the org changes. The effect also re-runs
    // when the user navigates back from a form page (component remounts).
    effect(() => {
      void this.configsService.load(this.organizationId());
    });
  }
}
