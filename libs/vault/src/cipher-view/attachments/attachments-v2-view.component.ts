// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NEVER, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { StateProvider } from "@bitwarden/common/platform/state";
import { EmergencyAccessId, OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  ItemModule,
  IconButtonModule,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { DownloadAttachmentComponent } from "../../components/download-attachment/download-attachment.component";

@Component({
  selector: "app-attachments-v2-view",
  templateUrl: "attachments-v2-view.component.html",
  imports: [
    CommonModule,
    JslibModule,
    ItemModule,
    IconButtonModule,
    SectionHeaderComponent,
    TypographyModule,
    DownloadAttachmentComponent,
  ],
})
export class AttachmentsV2ViewComponent {
  @Input() cipher: CipherView;

  // Required for fetching attachment data when viewed from cipher via emergency access
  @Input() emergencyAccessId?: EmergencyAccessId;

  @Input() admin: boolean = false;

  canAccessPremium: boolean;
  orgKey: OrgKey;

  constructor(
    private keyService: KeyService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private stateProvider: StateProvider,
    private accountService: AccountService,
  ) {
    this.subscribeToHasPremiumCheck();
    this.subscribeToOrgKey();
  }

  subscribeToHasPremiumCheck() {
    this.accountService.activeAccount$
      .pipe(
        switchMap((account) =>
          this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((hasPremium) => {
        this.canAccessPremium = hasPremium;
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
