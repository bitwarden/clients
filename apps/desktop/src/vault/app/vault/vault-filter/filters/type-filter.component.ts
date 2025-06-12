import { Component } from "@angular/core";
import { map } from "rxjs";

import { TypeFilterComponent as BaseTypeFilterComponent } from "@bitwarden/angular/vault/vault-filter/components/type-filter.component";
import { CIPHER_MENU_ITEMS } from "@bitwarden/common/vault/types/cipher-menu-items";
import { RestrictedItemTypesService } from "@bitwarden/vault";

@Component({
  selector: "app-type-filter",
  templateUrl: "type-filter.component.html",
  standalone: false,
})
export class TypeFilterComponent extends BaseTypeFilterComponent {
  protected typeFilters$ = this.restrictedItemTypesService.restricted$.pipe(
    map((restrictedItemTypes) =>
      // Filter out restricted item types from the typeFilters array
      CIPHER_MENU_ITEMS.filter(
        (typeFilter) =>
          !restrictedItemTypes.some(
            (restrictedType) =>
              restrictedType.allowViewOrgIds.length === 0 &&
              restrictedType.cipherType === typeFilter.type,
          ),
      ),
    ),
  );

  constructor(private restrictedItemTypesService: RestrictedItemTypesService) {
    super();
  }
}
