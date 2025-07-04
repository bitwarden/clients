// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionView } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ClientType } from "@bitwarden/common/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  ButtonLinkDirective,
  CardComponent,
  FormFieldModule,
  TypographyModule,
} from "@bitwarden/components";

import { OrgIconDirective } from "../../components/org-icon.directive";

@Component({
  selector: "app-item-details-v2",
  templateUrl: "item-details-v2.component.html",
  imports: [
    CommonModule,
    JslibModule,
    CardComponent,
    TypographyModule,
    OrgIconDirective,
    FormFieldModule,
    ButtonLinkDirective,
  ],
})
export class ItemDetailsV2Component implements OnInit {
  @Input() cipher: CipherView;
  @Input() organization?: Organization;
  @Input() collections?: CollectionView[];
  @Input() folder?: FolderView;
  @Input() hideOwner?: boolean = false;

  hasMultipleCollections: boolean = false;
  showAllDetails: boolean = false;

  ngOnInit() {
    this.hasMultipleCollections = this.cipher?.collectionIds?.length > 1;
  }

  get showOwnership() {
    return this.cipher.organizationId && this.organization && !this.hideOwner;
  }

  toggleShowMore() {
    this.showAllDetails = !this.showAllDetails;
  }

  protected readonly ClientType = ClientType;
}
