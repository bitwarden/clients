import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { distinctUntilChanged } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { VaultItemsComponent as BaseVaultItemsComponent } from "@bitwarden/angular/vault/components/vault-items.component";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { MenuModule } from "@bitwarden/components";

import { SearchBarService } from "../../../app/layout/search/search-bar.service";

@Component({
  selector: "app-vault-items-v2",
  templateUrl: "vault-items-v2.component.html",
  imports: [MenuModule, CommonModule, JslibModule, ScrollingModule],
})
export class VaultItemsV2Component extends BaseVaultItemsComponent {
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

  trackByFn(index: number, c: CipherView): string {
    return c.id;
  }
}
