import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EmergencyAccessId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { CipherFormConfigService, DefaultCipherFormConfigService } from "@bitwarden/vault";

import { SharedModule } from "../../../../shared/shared.module";
import { EmergencyAccessService } from "../../../emergency-access";

import { EmergencyViewDialogComponent } from "./emergency-view-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
 
@Component({
  templateUrl: "emergency-access-view.component.html",
  providers: [{ provide: CipherFormConfigService, useClass: DefaultCipherFormConfigService }],
  imports: [SharedModule],
})
export class EmergencyAccessViewComponent implements OnInit {
  id: EmergencyAccessId | null = null;
  ciphers: CipherView[] = [];
  loaded = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private emergencyAccessService: EmergencyAccessService,
    private dialogService: DialogService,
    private accountService: AccountService,
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
