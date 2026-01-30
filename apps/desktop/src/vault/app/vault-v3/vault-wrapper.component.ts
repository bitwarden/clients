import { CommonModule } from "@angular/common";
import { Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { VaultComponent as VaultOrigComponent } from "./vault-orig.component";
import { VaultComponent } from "./vault.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault-wrapper",
  template: '<ng-container *ngComponentOutlet="componentToRender()"></ng-container>',
  imports: [CommonModule],
})
export class VaultWrapperComponent {
  private configService: ConfigService = inject(ConfigService);

  protected readonly useMilestone3 = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.DesktopUiMigrationMilestone3),
  );

  protected readonly componentToRender = computed(() =>
    this.useMilestone3() ? VaultComponent : VaultOrigComponent,
  );
}
