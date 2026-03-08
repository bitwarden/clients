import { Component } from "@angular/core";
import { combineLatest, map, shareReplay } from "rxjs";

import { TypeFilterComponent as BaseTypeFilterComponent } from "@bitwarden/angular/vault/vault-filter/components/type-filter.component";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CIPHER_MENU_ITEMS } from "@bitwarden/common/vault/types/cipher-menu-items";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-type-filter",
  templateUrl: "type-filter.component.html",
  standalone: false,
})
export class TypeFilterComponent extends BaseTypeFilterComponent {
  protected typeFilters$ = combineLatest([
    this.restrictedItemTypesService.restricted$,
    this.configService.getFeatureFlag$(FeatureFlag.PM32009_NewItemTypes),
  ]).pipe(
    map(([restrictedItemTypes, canCreateBankAccount]) =>
      // Filter out restricted item types and feature-flagged types from the typeFilters array
      CIPHER_MENU_ITEMS.filter((typeFilter) => {
        if (!canCreateBankAccount && typeFilter.type === CipherType.BankAccount) {
          return false;
        }
        return !restrictedItemTypes.some(
          (restrictedType) =>
            restrictedType.allowViewOrgIds.length === 0 &&
            restrictedType.cipherType === typeFilter.type,
        );
      }),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  constructor(
    private restrictedItemTypesService: RestrictedItemTypesService,
    private configService: ConfigService,
  ) {
    super();
  }
}
