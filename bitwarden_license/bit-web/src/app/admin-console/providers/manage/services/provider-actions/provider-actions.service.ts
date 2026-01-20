import { inject, Injectable, signal } from "@angular/core";
import { firstValueFrom, switchMap, map } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderUserConfirmRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-confirm.request";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ProviderId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";
import { ProviderUser } from "@bitwarden/web-vault/app/admin-console/common/people-table-data-source";

export interface MemberActionResult {
  success: boolean;
  error?: string;
}

@Injectable()
export class ProviderActionsService {
  private apiService = inject(ApiService);
  private keyService = inject(KeyService);
  private accountService = inject(AccountService);
  private encryptService = inject(EncryptService);

  readonly isProcessing = signal(false);

  private startProcessing(): void {
    this.isProcessing.set(true);
  }

  private endProcessing(): void {
    this.isProcessing.set(false);
  }

  async deleteProviderUser(
    providerId: ProviderId,
    user: ProviderUser,
  ): Promise<MemberActionResult> {
    this.startProcessing();
    try {
      await this.apiService.deleteProviderUser(providerId, user.id);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message ?? String(error) };
    } finally {
      this.endProcessing();
    }
  }

  async reinviteProvider(providerId: ProviderId, user: ProviderUser): Promise<MemberActionResult> {
    this.startProcessing();
    try {
      await this.apiService.postProviderUserReinvite(providerId, user.id);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message ?? String(error) };
    } finally {
      this.endProcessing();
    }
  }

  async confirmProvider(
    user: ProviderUser,
    providerId: ProviderId,
    publicKey: Uint8Array,
  ): Promise<MemberActionResult> {
    this.startProcessing();
    try {
      const providerKey = await firstValueFrom(
        this.accountService.activeAccount$.pipe(
          getUserId,
          switchMap((userId) => this.keyService.providerKeys$(userId)),
          map((providerKeys) => providerKeys?.[providerId] ?? null),
        ),
      );
      assertNonNullish(providerKey, "Provider key not found");

      const key = await this.encryptService.encapsulateKeyUnsigned(providerKey, publicKey);
      assertNonNullish(key.encryptedString, "No key was provided");

      const request = new ProviderUserConfirmRequest(key.encryptedString);
      await this.apiService.postProviderUserConfirm(providerId, user.id, request);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message ?? String(error) };
    } finally {
      this.endProcessing();
    }
  }
}
