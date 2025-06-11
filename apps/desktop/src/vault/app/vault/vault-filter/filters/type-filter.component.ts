import { Component } from "@angular/core";
import { map } from "rxjs";

import { TypeFilterComponent as BaseTypeFilterComponent } from "@bitwarden/angular/vault/vault-filter/components/type-filter.component";
import { CipherType } from "@bitwarden/sdk-internal";
import { RestrictedItemTypesService } from "@bitwarden/vault";

@Component({
  selector: "app-type-filter",
  templateUrl: "type-filter.component.html",
  standalone: false,
})
export class TypeFilterComponent extends BaseTypeFilterComponent {
  typeFilters = [
    {
      id: "login",
      name: "typeLogin",
      type: CipherType.Login,
      icon: "bwi-globe",
    },
    {
      id: "card",
      name: "typeCard",
      type: CipherType.Card,
      icon: "bwi-credit-card",
    },
    {
      id: "identity",
      name: "typeIdentity",
      type: CipherType.Identity,
      icon: "bwi-id-card",
    },
    {
      id: "note",
      name: "typeSecureNote",
      type: CipherType.SecureNote,
      icon: "bwi-sticky-note",
    },
    {
      id: "sshKey",
      name: "typeSshKey",
      type: CipherType.SshKey,
      icon: "bwi-key",
    },
  ];

  protected typeFilters$ = this.restrictedItemTypesService.restricted$.pipe(
    map((restrictedItemTypes) =>
      // Filter out restricted item types from the typeFilters array
      this.typeFilters.filter(
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
