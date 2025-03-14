import { Component, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { CipherFormConfigService, DefaultCipherFormConfigService } from "@bitwarden/vault";

import { EmergencyAccessService } from "../../../emergency-access";

import { EmergencyViewDialogComponent } from "./emergency-view-dialog.component";

@Component({
  selector: "emergency-access-view",
  templateUrl: "emergency-access-view.component.html",
  providers: [{ provide: CipherFormConfigService, useClass: DefaultCipherFormConfigService }],
})
export class EmergencyAccessViewComponent implements OnInit {
  @ViewChild("attachments", { read: ViewContainerRef, static: true })
  attachmentsModalRef: ViewContainerRef | null = null;

  id: string | null = null;
  ciphers: CipherView[] = [];
  loaded = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private emergencyAccessService: EmergencyAccessService,
    private dialogService: DialogService,
  ) {}

  async ngOnInit() {
    const qParams = await firstValueFrom(this.route.params);
    if (qParams.id == null) {
      await this.router.navigate(["settings/emergency-access"]);
      return;
    }

    this.id = qParams.id;
    this.ciphers = await this.emergencyAccessService.getViewOnlyCiphers(qParams.id);
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
