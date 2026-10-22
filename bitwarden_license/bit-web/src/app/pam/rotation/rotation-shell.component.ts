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
 * Header and routed tabs for the rotation feature. Off the VFO1 flag the header hosts the active
 * tab's create action; on it, each tab hosts its own in its table toolbar.
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

  /** Inherited from the org route, since `paramsInheritanceStrategy` is `"always"`. */
  protected readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as OrganizationId)),
    { requireSync: true },
  );

  constructor() {
    // Loads on org change, and again on remount when the user navigates back from a form page.
    effect(() => {
      void this.configsService.load(this.organizationId());
    });
  }
}
