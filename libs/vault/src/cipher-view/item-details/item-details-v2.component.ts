// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, computed, input, signal } from "@angular/core";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
import { toSignal } from "@angular/core/rxjs-interop";
import { fromEvent, map, startWith } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionTypes, CollectionView } from "@bitwarden/admin-console/common";
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
export class ItemDetailsV2Component {
  readonly hideOwner = input<boolean>(false);
  readonly cipher = input.required<CipherView>();
  readonly organization = input<Organization | undefined>();
  readonly folder = input<FolderView | undefined>();
  readonly collections = input<CollectionView[] | undefined>();
  readonly showAllDetails = signal(false);

  readonly showOwnership = computed(() => {
    return this.cipher().organizationId && this.organization() && !this.hideOwner();
  });

  readonly hasSmallScreen = toSignal(
    fromEvent(window, "resize").pipe(
      map(() => window.innerWidth),
      startWith(window.innerWidth),
      map((width) => width < 681),
    ),
  );

  // Array to hold all details of item. Organization, Collections, and Folder
  readonly allItems = computed(() => {
    let items: any[] = [];
    if (this.showOwnership() && this.organization()) {
      items.push(this.organization());
    }
    if (this.cipher().collectionIds?.length > 0 && this.collections()) {
      items = [...items, ...this.collections()];
    }
    if (this.cipher().folderId && this.folder()) {
      items.push(this.folder());
    }
    return items;
  });

  readonly showItems = computed(() => {
    if (
      this.hasSmallScreen() &&
      this.allItems().length > 2 &&
      !this.showAllDetails() &&
      this.cipher().collectionIds?.length > 1
    ) {
      return this.allItems().slice(0, 2);
    } else {
      return this.allItems();
    }
  });

  constructor(private i18nService: I18nService) {}

  toggleShowMore() {
    this.showAllDetails.update((value) => !value);
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

  getIconClass(item: Organization | CollectionView | FolderView): string {
    if (item instanceof CollectionView) {
      return item.type === CollectionTypes.DefaultUserCollection
        ? "bwi-user"
        : "bwi-collection-shared";
    } else if (item instanceof FolderView) {
      return "bwi-folder";
    }
    return "";
  }

  getItemTitle(item: Organization | CollectionView | FolderView): string {
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
