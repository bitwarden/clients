// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { ModalService } from "@bitwarden/angular/services/modal.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { CipherFormConfigService, DefaultCipherFormConfigService } from "@bitwarden/vault";

import { EmergencyAccessService } from "../../../emergency-access";
import { EmergencyAccessAttachmentsComponent } from "../attachments/emergency-access-attachments.component";

import { EmergencyAddEditCipherComponent } from "./emergency-add-edit-cipher.component";
import { EmergencyViewDialogComponent } from "./emergency-view-dialog.component";

@Component({
  selector: "emergency-access-view",
  templateUrl: "emergency-access-view.component.html",
  providers: [{ provide: CipherFormConfigService, useClass: DefaultCipherFormConfigService }],
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class EmergencyAccessViewComponent implements OnInit {
  @ViewChild("cipherAddEdit", { read: ViewContainerRef, static: true })
  cipherAddEditModalRef: ViewContainerRef;
  @ViewChild("attachments", { read: ViewContainerRef, static: true })
  attachmentsModalRef: ViewContainerRef;

  id: string;
  ciphers: CipherView[] = [];
  loaded = false;

  constructor(
    private modalService: ModalService,
    private router: Router,
    private route: ActivatedRoute,
    private emergencyAccessService: EmergencyAccessService,
    private configService: ConfigService,
    private dialogService: DialogService,
  ) {}

  ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.route.params.subscribe((qParams) => {
      if (qParams.id == null) {
        return this.router.navigate(["settings/emergency-access"]);
      }

      this.id = qParams.id;

      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.load();
    });
  }

  async selectCipher(cipher: CipherView) {
    const browserRefreshEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.ExtensionRefresh,
    );

    if (browserRefreshEnabled) {
      EmergencyViewDialogComponent.open(this.dialogService, {
        cipher,
      });
      return;
    }

    // FIXME PM-15385: Remove below dialog service logic once extension refresh is live.

    // eslint-disable-next-line
    const [_, childComponent] = await this.modalService.openViewRef(
      EmergencyAddEditCipherComponent,
      this.cipherAddEditModalRef,
      (comp) => {
        comp.cipherId = cipher == null ? null : cipher.id;
        comp.cipher = cipher;
      },
    );

    return childComponent;
  }

  async load() {
    this.ciphers = await this.emergencyAccessService.getViewOnlyCiphers(this.id);
    this.loaded = true;
  }

  async viewAttachments(cipher: CipherView) {
    await this.modalService.openViewRef(
      EmergencyAccessAttachmentsComponent,
      this.attachmentsModalRef,
      (comp) => {
        comp.cipher = cipher;
        comp.emergencyAccessId = this.id;
      },
    );
  }
}
