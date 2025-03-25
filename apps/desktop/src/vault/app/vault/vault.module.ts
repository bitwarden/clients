import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";

import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  CipherFormConfigService,
  CipherFormModule,
  CipherViewComponent,
  DefaultCipherFormConfigService,
  ChangeLoginPasswordService,
  DefaultChangeLoginPasswordService,
} from "@bitwarden/vault";

import { NavComponent } from "../../../app/layout/nav.component";
import { SharedModule } from "../../../app/shared/shared.module";
import { DesktopPremiumUpgradePromptService } from "../../../services/desktop-premium-upgrade-prompt.service";
import { DesktopViewPasswordHistoryService } from "../../../services/desktop-view-password-history.service";

import { ItemFooterComponent } from "./item-footer.component";
import { VaultFilterModule } from "./vault-filter/vault-filter.module";
import { VaultItemsComponent } from "./vault-items.component";
import { VaultComponent } from "./vault.component";
import { ViewComponent } from "./view.component";

@NgModule({
  declarations: [VaultComponent, VaultItemsComponent, ViewComponent],
  imports: [
    CommonModule,
    CipherViewComponent,
    CipherFormModule,
    I18nPipe,
    NavComponent,
    SharedModule,
    VaultFilterModule,
    ItemFooterComponent,
  ],
  providers: [
    {
      provide: CipherFormConfigService,
      useClass: DefaultCipherFormConfigService,
    },
    {
      provide: ChangeLoginPasswordService,
      useClass: DefaultChangeLoginPasswordService,
    },
    {
      provide: ViewPasswordHistoryService,
      useClass: DesktopViewPasswordHistoryService,
    },
    {
      provide: PremiumUpgradePromptService,
      useClass: DesktopPremiumUpgradePromptService,
    },
  ],
})
export class VaultModule {}
