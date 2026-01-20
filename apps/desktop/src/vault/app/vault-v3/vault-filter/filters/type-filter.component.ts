import { CommonModule } from "@angular/common";
import { Component, input, inject } from "@angular/core";
import { map, shareReplay } from "rxjs";

import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { NavigationModule, A11yTitleDirective } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { VaultFilter, CipherTypeFilter } from "@bitwarden/vault";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-type-filter",
  templateUrl: "type-filter.component.html",
  imports: [CommonModule, A11yTitleDirective, NavigationModule, I18nPipe],
})
export class TypeFilterComponent {
  private restrictedItemTypesService: RestrictedItemTypesService = inject(
    RestrictedItemTypesService,
  );

  protected readonly cipherTypes = input.required<TreeNode<CipherTypeFilter>>();
  protected readonly activeFilter = input<VaultFilter>();

  protected applyTypeFilter(event: Event, cipherType: TreeNode<CipherTypeFilter>) {
    event.stopPropagation();
    const filter = this.activeFilter();

    if (filter) {
      filter.selectedCipherTypeNode = cipherType;
    }
  }

  protected applyAllItemsFilter(event: Event) {
    const filter = this.activeFilter();

    if (filter) {
      filter.selectedCipherTypeNode = this.cipherTypes();
    }
  }

  protected typeFilters$ = this.restrictedItemTypesService.restricted$.pipe(
    map((restrictedItemTypes) =>
      // Filter out restricted item types from the typeFilters array
      this.cipherTypes().children.filter(
        (type) =>
          !restrictedItemTypes.some(
            (restrictedType) =>
              restrictedType.allowViewOrgIds.length === 0 &&
              restrictedType.cipherType === type.node.type,
          ),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
