import { Component, OnInit } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EmergencyAccessId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { BreadcrumbsModule, DialogService } from "@bitwarden/components";
import {
  CipherFormConfigService,
  DefaultCipherFormConfigService,
  Vfo1IconPipe,
} from "@bitwarden/vault";

import { HeaderModule } from "../../../../layouts/header/header.module";
import { SharedModule } from "../../../../shared/shared.module";
import { EmergencyAccessService } from "../../../emergency-access";

import { EmergencyViewDialogComponent } from "./emergency-view-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "emergency-access-view.component.html",
  providers: [{ provide: CipherFormConfigService, useClass: DefaultCipherFormConfigService }],
  imports: [SharedModule, HeaderModule, BreadcrumbsModule, Vfo1IconPipe],
})
export class EmergencyAccessViewComponent implements OnInit {
  id: EmergencyAccessId | null = null;
  ciphers: CipherView[] = [];
  loaded = false;

  protected readonly showBreadcrumbs = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private emergencyAccessService: EmergencyAccessService,
    private dialogService: DialogService,
    private accountService: AccountService,
    private configService: ConfigService,
  ) {}

  async ngOnInit() {
    const qParams = await firstValueFrom(this.route.params);
    if (qParams.id == null) {
      await this.router.navigate(["settings/emergency-access"]);
      return;
    }

    this.id = qParams.id;
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.ciphers = await this.emergencyAccessService.getViewOnlyCiphers(qParams.id, userId);
    this.loaded = true;
  }

  async selectCipher(cipher: CipherView) {
    EmergencyViewDialogComponent.open(this.dialogService, {
      cipher,
      emergencyAccessId: this.id!,
    });
    return;
  }
}
