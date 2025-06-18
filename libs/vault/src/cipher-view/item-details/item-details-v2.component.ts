// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionView } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  CardComponent,
  FormFieldModule,
  SectionHeaderComponent,
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
    SectionHeaderComponent,
    TypographyModule,
    OrgIconDirective,
    FormFieldModule,
  ],
})
export class ItemDetailsV2Component {
  @Input() cipher: CipherView;
  @Input() organization?: Organization;
  @Input() collections?: CollectionView[];
  @Input() folder?: FolderView;
  @Input() hideOwner?: boolean = false;

  get showOwnership() {
    return this.cipher.organizationId && this.organization && !this.hideOwner;
  }
}
