// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { distinctUntilChanged } from "rxjs";

import { VaultItemsComponent as BaseVaultItemsComponent } from "@bitwarden/angular/vault/components/vault-items.component";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { SearchBarService } from "../../../app/layout/search/search-bar.service";

@Component({
  selector: "app-vault-items",
  templateUrl: "vault-items.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class VaultItemsComponent extends BaseVaultItemsComponent {
  constructor(
    searchService: SearchService,
    searchBarService: SearchBarService,
    cipherService: CipherService,
    accountService: AccountService,
  ) {
    super(searchService, cipherService, accountService);

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    searchBarService.searchText$.pipe(distinctUntilChanged()).subscribe((searchText) => {
      this.searchText = searchText;
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.search(200);
    });
  }

  trackByFn(index: number, c: CipherView) {
    return c.id;
  }
}
