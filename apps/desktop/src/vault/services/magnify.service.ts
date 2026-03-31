import { Injectable } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

@Injectable()
export class MagnifyService {
  constructor(
    private accountService: AccountService,
    private cipherService: CipherService,
    private searchService: SearchService,
    private platformUtilsService: PlatformUtilsService,
  ) {}

  init() {
    ipc.platform.magnify.onCommand(async (payload) => {
      const { command, input } = payload;

      switch (command) {
        case "cipherSearch":
          await this.handleSearch(input);
          break;
        case "cipherPasswordCopy":
          await this.handlePasswordCopy(input);
          break;
        case "cipherUsernameCopy":
          await this.handleUsernameCopy(input);
          break;
        case "cipherLaunch":
          await this.handleLaunch(input);
          break;
      }
    });
  }

  private async handleSearch(query: string) {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id)));

    if (!userId) {
      ipc.platform.magnify.sendResults({ command: "cipherSearch", results: [] });
      return;
    }

    const allCiphers = await firstValueFrom(this.cipherService.cipherViews$(userId));
    const loginCiphers = allCiphers.filter((c) => c.type === CipherType.Login && !c.deletedDate);

    const searched = query?.trim()
      ? await this.searchService.searchCiphers(userId, query, null, loginCiphers)
      : loginCiphers;

    const results = searched.slice(0, 7).map((c) => ({
      id: c.id,
      name: c.name,
      username: c.login?.username ?? "",
      faviconUrl: this.getFaviconUrl(c),
      hasUri: !!c.login?.uris?.[0]?.uri,
    }));

    ipc.platform.magnify.sendResults({ command: "cipherSearch", results });
  }

  private async handlePasswordCopy(cipherId: string) {
    const cipher = await this.getCipherById(cipherId);
    if (cipher?.login?.password) {
      this.platformUtilsService.copyToClipboard(cipher.login.password);
    }
  }

  private async handleUsernameCopy(cipherId: string) {
    const cipher = await this.getCipherById(cipherId);
    if (cipher?.login?.username) {
      this.platformUtilsService.copyToClipboard(cipher.login.username);
    }
  }

  private async handleLaunch(cipherId: string) {
    const cipher = await this.getCipherById(cipherId);
    const uri = cipher?.login?.uris?.[0]?.uri;
    if (uri) {
      this.platformUtilsService.launchUri(uri);
    }
  }

  private async getCipherById(cipherId: string): Promise<CipherView | undefined> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id)));
    if (!userId) {
      return undefined;
    }
    const ciphers = await firstValueFrom(this.cipherService.cipherViews$(userId));
    return ciphers.find((c) => c.id === cipherId);
  }

  private getFaviconUrl(cipher: CipherView): string | undefined {
    const uri = cipher.login?.uris?.[0]?.uri;
    if (!uri) {
      return undefined;
    }
    try {
      const { hostname } = new URL(uri);
      return `https://icons.bitwarden.net/${hostname}/icon.png`;
    } catch {
      return undefined;
    }
  }
}
