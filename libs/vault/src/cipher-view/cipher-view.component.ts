import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Observable, Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CollectionId } from "@bitwarden/common/types/guid";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { SearchModule, ButtonModule, IconButtonModule } from "@bitwarden/components";

import { PopupFooterComponent } from "../../../../apps/browser/src/platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../apps/browser/src/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../apps/browser/src/platform/popup/layout/popup-page.component";

import { AdditionalInformationComponent } from "./additional-information/additional-information.component";
import { AttachmentsV2Component } from "./attachments/attachments-v2.component";
import { CustomFieldV2Component } from "./custom-fields/custom-fields-v2.component";
import { ItemDetailsV2Component } from "./item-details/item-details-v2.component";
import { ItemHistoryV2Component } from "./item-history/item-history-v2.component";

@Component({
  selector: "app-cipher-view",
  templateUrl: "cipher-view.component.html",
  standalone: true,
  imports: [
    CommonModule,
    SearchModule,
    JslibModule,
    FormsModule,
    ButtonModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    ItemDetailsV2Component,
    AdditionalInformationComponent,
    AttachmentsV2Component,
    ItemHistoryV2Component,
    CustomFieldV2Component,
    IconButtonModule,
  ],
})
export class CipherViewComponent implements OnInit {
  @Input() cipher: CipherView;
  organization$: Observable<Organization>;
  folder$: Observable<FolderView>;
  collections$: Observable<CollectionView[]>;
  private destroyed$: Subject<void> = new Subject();

  constructor(
    private organizationService: OrganizationService,
    private collectionService: CollectionService,
    private folderService: FolderService,
  ) {}

  async ngOnInit() {
    await this.loadCipherData();
  }
  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  async loadCipherData() {
    if (this.cipher.collectionIds.length > 0) {
      this.collections$ = this.collectionService
        .decryptedCollectionViews$(this.cipher.collectionIds as CollectionId[])
        .pipe(takeUntil(this.destroyed$));
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
