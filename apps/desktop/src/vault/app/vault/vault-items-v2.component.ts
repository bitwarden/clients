import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { distinctUntilChanged } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { VaultItemsComponent as BaseVaultItemsComponent } from "@bitwarden/angular/vault/components/vault-items.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { MenuModule } from "@bitwarden/components";

import { SearchBarService } from "../../../app/layout/search/search-bar.service";

@Component({
  selector: "app-vault-items-v2",
  templateUrl: "vault-items-v2.component.html",
  imports: [MenuModule, CommonModule, JslibModule, ScrollingModule],
})
export class VaultItemsV2Component<C extends CipherViewLike> extends BaseVaultItemsComponent<C> {
  protected CipherViewLikeUtils = CipherViewLikeUtils;
  constructor(
    searchService: SearchService,
    private readonly searchBarService: SearchBarService,
    cipherService: CipherService,
    accountService: AccountService,
    restrictedItemTypesService: RestrictedItemTypesService,
  ) {
    super(searchService, cipherService, accountService, restrictedItemTypesService);

    this.searchBarService.searchText$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((searchText) => {
        this.searchText = searchText!;
      });
  }

  trackByFn(index: number, c: C): string {
    return uuidAsString(c.id!);
  }
}
