import { Pipe, PipeTransform } from "@angular/core";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

@Pipe({
  name: "searchCiphers",
  standalone: false,
})
export class SearchCiphersPipe implements PipeTransform {
  transform(ciphers: CipherView[], searchText: string, deleted = false): CipherView[] {
    if (ciphers == null || ciphers.length === 0) {
      return [];
    }

    if (searchText == null || searchText.length < 2) {
      return ciphers.filter((c) => {
        return deleted !== c.isDeleted;
      });
    }

    searchText = searchText.trim().toLowerCase();
    return ciphers.filter((c) => {
      if (deleted !== c.isDeleted) {
        return false;
      }
      if (c.name != null && c.name.toLowerCase().indexOf(searchText) > -1) {
        return true;
      }
      if (searchText.length >= 8 && c.id.startsWith(searchText)) {
        return true;
      }
      if (c.subTitle != null && c.subTitle.toLowerCase().indexOf(searchText) > -1) {
        return true;
      }
      if (c.login && c.login.uri != null && c.login.uri.toLowerCase().indexOf(searchText) > -1) {
        return true;
      }

      return false;
    });
  }
}
