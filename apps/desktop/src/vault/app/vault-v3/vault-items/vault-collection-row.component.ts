// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgClass } from "@angular/common";
import { Component, input, output } from "@angular/core";
import { RouterLink } from "@angular/router";

import {
  CollectionView,
  CollectionTypes,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CheckboxModule, LinkModule, TableModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { GetOrgNameFromIdPipe, OrganizationNameBadgeComponent } from "@bitwarden/vault";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tr[appVaultCollectionRow]",
  templateUrl: "vault-collection-row.component.html",
  imports: [
    TableModule,
    LinkModule,
    NgClass,
    I18nPipe,
    RouterLink,
    OrganizationNameBadgeComponent,
    GetOrgNameFromIdPipe,
    CheckboxModule,
  ],
})
export class VaultCollectionRowComponent {
  protected RowHeightClass = `tw-h-[76.5px]`;
  protected DefaultCollectionType = CollectionTypes.DefaultUserCollection;

  protected readonly disabled = input<boolean>();
  protected readonly collection = input<CollectionView>();
  protected readonly showOwner = input<boolean>();
  protected readonly organizations = input<Organization[]>();
  protected readonly showBatchBar = input<boolean>(false);
  protected readonly selected = input<boolean>(false);
  protected readonly checkboxChange = output<void>();
}
