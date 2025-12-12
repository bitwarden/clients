import { Component, input, inject } from "@angular/core";
import { map, shareReplay } from "rxjs";

import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { VaultFilter, CipherTypeFilter } from "@bitwarden/vault";

import { VAULT_FILTER_IMPORTS } from "../shared-filter-imports";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-type-filter",
  templateUrl: "type-filter.component.html",
  standalone: true,
  imports: [...VAULT_FILTER_IMPORTS],
})
export class TypeFilterComponent {
  private restrictedItemTypesService: RestrictedItemTypesService = inject(
    RestrictedItemTypesService,
  );

  protected readonly cipherTypes = input<TreeNode<CipherTypeFilter>>();
  protected readonly activeFilter = input<VaultFilter>();

  protected applyFilter(cipherType: TreeNode<CipherTypeFilter>) {
    const filter = this.activeFilter();

    if (filter) {
      filter.selectedCipherTypeNode = cipherType;
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
