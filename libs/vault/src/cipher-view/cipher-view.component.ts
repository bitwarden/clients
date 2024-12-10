// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges, OnDestroy } from "@angular/core";
import { firstValueFrom, Observable, Subject, takeUntil } from "rxjs";

import { CollectionService, CollectionView } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { isCardExpired } from "@bitwarden/common/autofill/utils";
import { CollectionId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { CalloutModule, SearchModule } from "@bitwarden/components";

import { AdditionalOptionsComponent } from "./additional-options/additional-options.component";
import { AttachmentsV2ViewComponent } from "./attachments/attachments-v2-view.component";
import { AutofillOptionsViewComponent } from "./autofill-options/autofill-options-view.component";
import { CardDetailsComponent } from "./card-details/card-details-view.component";
import { CustomFieldV2Component } from "./custom-fields/custom-fields-v2.component";
import { ItemDetailsV2Component } from "./item-details/item-details-v2.component";
import { ItemHistoryV2Component } from "./item-history/item-history-v2.component";
import { LoginCredentialsViewComponent } from "./login-credentials/login-credentials-view.component";
import { SshKeyViewComponent } from "./sshkey-sections/sshkey-view.component";
import { ViewIdentitySectionsComponent } from "./view-identity-sections/view-identity-sections.component";

@Component({
  selector: "app-cipher-view",
  templateUrl: "cipher-view.component.html",
  standalone: true,
  imports: [
    CalloutModule,
    CommonModule,
    SearchModule,
    JslibModule,
    ItemDetailsV2Component,
    AdditionalOptionsComponent,
    AttachmentsV2ViewComponent,
    ItemHistoryV2Component,
    CustomFieldV2Component,
    CardDetailsComponent,
    SshKeyViewComponent,
    ViewIdentitySectionsComponent,
    LoginCredentialsViewComponent,
    AutofillOptionsViewComponent,
  ],
})
export class CipherViewComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) cipher: CipherView;

  /**
   * Optional list of collections the cipher is assigned to. If none are provided, they will be fetched using the
   * `CipherService` and the `collectionIds` property of the cipher.
   */
  @Input() collections: CollectionView[];

  /** Should be set to true when the component is used within the Admin Console */
  @Input() isAdminConsole?: boolean = false;

  organization$: Observable<Organization>;
  folder$: Observable<FolderView>;
  private destroyed$: Subject<void> = new Subject();
  cardIsExpired: boolean = false;

  constructor(
    private organizationService: OrganizationService,
    private collectionService: CollectionService,
    private folderService: FolderService,
  ) {}

  async ngOnChanges() {
    if (this.cipher == null) {
      return;
    }

    await this.loadCipherData();

    this.cardIsExpired = isCardExpired(this.cipher.card);
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  get hasCard() {
    const { cardholderName, code, expMonth, expYear, number } = this.cipher.card;
    return cardholderName || code || expMonth || expYear || number;
  }

  get hasLogin() {
    const { username, password, totp } = this.cipher.login;
    return username || password || totp;
  }

  get hasAutofill() {
    return this.cipher.login?.uris.length > 0;
  }

  get hasSshKey() {
    return this.cipher.sshKey?.privateKey;
  }

  async loadCipherData() {
    // Load collections if not provided and the cipher has collectionIds
    if (
      this.cipher.collectionIds &&
      this.cipher.collectionIds.length > 0 &&
      (!this.collections || this.collections.length === 0)
    ) {
      this.collections = await firstValueFrom(
        this.collectionService.decryptedCollectionViews$(
          this.cipher.collectionIds as CollectionId[],
        ),
      );
    }

    if (this.cipher.organizationId) {
      this.organization$ = this.organizationService
        .get$(this.cipher.organizationId)
        .pipe(takeUntil(this.destroyed$));
    }

    if (this.cipher.folderId) {
      this.folder$ = this.folderService
        .getDecrypted$(this.cipher.folderId)
        .pipe(takeUntil(this.destroyed$));
    }
  }
}
