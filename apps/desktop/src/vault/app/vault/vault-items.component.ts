import { AfterViewInit, Component } from "@angular/core";

import { VaultItemsComponent as BaseVaultItemsComponent } from "@bitwarden/angular/vault/components/vault-items.component";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { SearchBarService } from "../../../app/layout/search/search-bar.service";
import { ipcRenderer  } from 'electron';

@Component({
  selector: "app-vault-items",
  templateUrl: "vault-items.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class VaultItemsComponent extends BaseVaultItemsComponent {
  constructor(
    searchService: SearchService,
    searchBarService: SearchBarService,
    cipherService: CipherService
  ) {
    super(searchService, cipherService);
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    searchBarService.searchText$.subscribe((searchText) => {
      this.searchText = searchText;
      this.search(200);
    });
  }

  protected onLoadComplete(){
    let accounts: { username: string; password: string; }[] = [];
    this.ciphers.forEach(c => {
      let account = {username: c.name, password: c.login.password};
      accounts.push(account)
    });
    ipcRenderer.send('on-cipher-load', accounts);
  }

  trackByFn(index: number, c: CipherView) {
    return c.id;
  }
}
