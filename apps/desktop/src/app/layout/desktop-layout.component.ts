import { Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { map } from "rxjs";

import { PasswordManagerLogo } from "@bitwarden/assets/svg";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { DialogService, LayoutComponent, NavigationModule } from "@bitwarden/components";
import { SendPolicyService } from "@bitwarden/send-ui";
import { I18nPipe } from "@bitwarden/ui-common";
import { VaultManageNavComponent, VaultNavSectionComponent } from "@bitwarden/vault";

import { VaultFilterComponent } from "../../vault/app/vault-v3/vault-filter/vault-filter.component";
import { ExportDesktopComponent } from "../tools/export/export-desktop.component";
import { CredentialGeneratorComponent } from "../tools/generator/credential-generator.component";
import { ImportDesktopComponent } from "../tools/import/import-desktop.component";
import { SendFiltersNavComponent } from "../tools/send/send-filters-nav.component";

import { DesktopSideNavComponent } from "./desktop-side-nav.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-layout",
  imports: [
    RouterModule,
    I18nPipe,
    LayoutComponent,
    NavigationModule,
    DesktopSideNavComponent,
    VaultFilterComponent,
    SendFiltersNavComponent,
    VaultNavSectionComponent,
    VaultManageNavComponent,
  ],
  templateUrl: "./desktop-layout.component.html",
})
export class DesktopLayoutComponent {
  private dialogService = inject(DialogService);
  private sendPolicyService = inject(SendPolicyService);
  private configService = inject(ConfigService);

  protected readonly logo = PasswordManagerLogo;

  protected readonly sendEnabled = toSignal(
    this.sendPolicyService.disableSend$.pipe(map((disableSend) => !disableSend)),
    { initialValue: true },
  );

  protected readonly vfo1Foundation = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  protected openGenerator() {
    this.dialogService.open(CredentialGeneratorComponent);
  }

  protected openImport() {
    this.dialogService.open(ImportDesktopComponent);
  }

  protected openExport() {
    this.dialogService.open(ExportDesktopComponent);
  }
}
