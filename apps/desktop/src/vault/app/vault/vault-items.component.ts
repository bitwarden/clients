// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { distinctUntilChanged } from "rxjs";

import { VaultItemsComponent as BaseVaultItemsComponent } from "@bitwarden/angular/vault/components/vault-items.component";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { SearchBarService } from "../../../app/layout/search/search-bar.service";

@Component({
  selector: "app-vault-items",
  templateUrl: "vault-items.component.html",
  standalone: false,
})
export class VaultItemsComponent<C extends CipherViewLike> extends BaseVaultItemsComponent<C> {
  protected CipherViewLikeUtils = CipherViewLikeUtils;
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
    });
  }

  trackByFn(index: number, c: C) {
    return c.id;
  }
}
