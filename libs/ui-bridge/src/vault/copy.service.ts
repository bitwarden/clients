import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";

@Injectable({ providedIn: "root" })
export class CopyBridgeService {
  private readonly platformUtils = inject(PlatformUtilsService);
  private readonly totpService = inject(TotpService);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  copyToClipboard(text: string): void {
    this.platformUtils.copyToClipboard(text, { clearing: true, clearMs: 30000 });
  }

  async copyUsername(cipherId: string): Promise<string | null> {
    const userId = await firstValueFrom(this.activeUserId$);
    const all = await this.cipherService.getAllDecrypted(userId);
    const cipher = all.find((c) => c.id === cipherId);
    const value = cipher?.login?.username;
    if (value) {
      this.copyToClipboard(value);
    }
    return value ?? null;
  }

  async copyPassword(cipherId: string): Promise<string | null> {
    const userId = await firstValueFrom(this.activeUserId$);
    const all = await this.cipherService.getAllDecrypted(userId);
    const cipher = all.find((c) => c.id === cipherId);
    const value = cipher?.login?.password;
    if (value) {
      this.copyToClipboard(value);
    }
    return value ?? null;
  }

  /**
   * Opens the login's website in the default browser and places the password on
   * the clipboard (auto-clearing) so it's ready to paste. The desktop app cannot
   * inject keystrokes into a third-party browser — that's the browser extension's
   * job — so "fill" here means launch + clipboard.
   */
  async openAndFill(cipherId: string): Promise<boolean> {
    const userId = await firstValueFrom(this.activeUserId$);
    const all = await this.cipherService.getAllDecrypted(userId);
    const cipher = all.find((c) => c.id === cipherId);
    const rawUri = cipher?.login?.uri ?? cipher?.login?.uris?.find((u) => !!u.uri)?.uri;
    if (!rawUri) {
      return false;
    }
    const password = cipher?.login?.password;
    if (password) {
      this.copyToClipboard(password);
    }
    const uri = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawUri) ? rawUri : `https://${rawUri}`;
    this.platformUtils.launchUri(uri);
    return true;
  }

  async copyTotp(cipherId: string): Promise<string | null> {
    const userId = await firstValueFrom(this.activeUserId$);
    const all = await this.cipherService.getAllDecrypted(userId);
    const cipher = all.find((c) => c.id === cipherId);
    if (!cipher?.login?.totp) {
      return null;
    }
    const response = await firstValueFrom(this.totpService.getCode$(cipher.login.totp));
    this.copyToClipboard(response.code);
    return response.code;
  }
}
