// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule, DOCUMENT } from "@angular/common";
import { Component, inject, input, OnChanges } from "@angular/core";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionView } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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
export class ItemDetailsV2Component implements OnChanges {
  hideOwner = input<boolean>(false);
  cipher = input.required<CipherView>();
  organization = input<Organization | undefined>();
  folder = input<FolderView | undefined>();
  collections = input<CollectionView[] | undefined>();

  showAllDetails: boolean = false;

  // Array to hold all details of item. Organization, Collections, and Folder
  allItems: any[] = [];

  // Array to hold the display pieces of the item details (dependent on allItems and screen size)
  showItems: any[] = [];

  // Inject the document to check for screen size
  private document = inject(DOCUMENT);
  isSmallScreen = false;

  constructor(private i18nService: I18nService) {}

  ngOnChanges() {
    this.allItems = [];
    this.isSmallScreen = this.hasSmallScreen();

    if (this.showOwnership && this.organization()) {
      this.allItems.push(this.organization());
    }
    if (this.cipher().collectionIds?.length > 0 && this.collections()) {
      this.allItems = [...this.allItems, ...this.collections()];
    }
    if (this.cipher().folderId && this.folder()) {
      this.allItems.push(this.folder());
    }
    this.showItems = [...this.allItems];

    // If the screen is small, we only show the first two items
    if (this.isSmallScreen && this.allItems.length > 2) {
      this.setItemsForSmallScreen();
    }
  }

  get showOwnership() {
    return this.cipher().organizationId && this.organization() && !this.hideOwner();
  }

  toggleShowMore() {
    this.showAllDetails = !this.showAllDetails;
    if (this.showAllDetails) {
      this.showItems = [...this.allItems];
    } else {
      this.showItems = this.allItems.slice(0, 2);
    }
  }

  hasSmallScreen() {
    return this.document.documentElement.clientWidth < 681;
  }

  setItemsForSmallScreen() {
    this.showItems = this.allItems.slice(0, 2);
  }

  getAriaLabel(item: Organization | CollectionView | FolderView): string {
    if (item instanceof Organization) {
      return this.i18nService.t("owner") + item.name;
    } else if (item instanceof CollectionView) {
      return this.i18nService.t("collection") + item.name;
    } else if (item instanceof FolderView) {
      return this.i18nService.t("folder") + item.name;
    }
    return "";
  }

  getIconClass(item: CollectionView | FolderView): string {
    if (item instanceof CollectionView) {
      return "bwi-collection-shared";
    } else if (item instanceof FolderView) {
      return "bwi-folder";
    }
    return "";
  }

  getItemTitle(item: CollectionView | FolderView): string {
    if (item instanceof CollectionView) {
      return this.i18nService.t("collection");
    } else if (item instanceof FolderView) {
      return this.i18nService.t("folder");
    }
    return "";
  }

  isOrgIcon(item: Organization | CollectionView | FolderView): boolean {
    return item instanceof Organization;
  }
}
