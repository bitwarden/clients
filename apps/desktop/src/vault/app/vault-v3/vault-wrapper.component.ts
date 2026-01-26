import { CommonModule } from "@angular/common";
import { Component, OnInit, Type } from "@angular/core";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { VaultComponent as VaultOrigComponent } from "./vault-orig.component";
import { VaultComponent } from "./vault.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault-wrapper",
  template: '<ng-container *ngComponentOutlet="componentToRender"></ng-container>',
  imports: [CommonModule],
})
export class VaultWrapperComponent implements OnInit {
   
  componentToRender: Type<any> | null = null;

  constructor(private configService: ConfigService) {}

  async ngOnInit() {
    const useMilestone3 = await this.configService.getFeatureFlag(
      FeatureFlag.DesktopUiMigrationMilestone3,
    );

    this.componentToRender = useMilestone3 ? VaultComponent : VaultOrigComponent;
  }
}
