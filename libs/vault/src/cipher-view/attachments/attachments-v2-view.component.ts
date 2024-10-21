import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NEVER, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { StateProvider } from "@bitwarden/common/platform/state";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  ItemModule,
  IconButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { DownloadAttachmentComponent } from "../../components/download-attachment/download-attachment.component";

@Component({
  selector: "app-attachments-v2-view",
  templateUrl: "attachments-v2-view.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    ItemModule,
    IconButtonModule,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    DownloadAttachmentComponent,
  ],
})
export class AttachmentsV2ViewComponent {
  @Input() cipher: CipherView;

  canAccessPremium: boolean;
  orgKey: OrgKey;

  constructor(
    private keyService: KeyService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private stateProvider: StateProvider,
  ) {
    this.subscribeToHasPremiumCheck();
    this.subscribeToOrgKey();
  }

  subscribeToHasPremiumCheck() {
    this.billingAccountProfileStateService.hasPremiumFromAnySource$
      .pipe(takeUntilDestroyed())
      .subscribe((data) => {
        this.canAccessPremium = data;
      });
  }

  subscribeToOrgKey() {
    this.stateProvider.activeUserId$
      .pipe(
        switchMap((userId) => (userId != null ? this.keyService.orgKeys$(userId) : NEVER)),
        takeUntilDestroyed(),
      )
      .subscribe((data: Record<OrganizationId, OrgKey> | null) => {
        if (data) {
          this.orgKey = data[this.cipher.organizationId as OrganizationId];
        }
      });
  }
}
