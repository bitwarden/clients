import { Injectable } from "@angular/core";
import { filter, firstValueFrom, map, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  DECRYPT_ERROR,
  EncryptService,
  EncString,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";

import { SecretVersionView } from "../models/view/secret-version.view";

import { SecretVersionListResponse } from "./responses/secret-version-list.response";
import { SecretVersionResponse } from "./responses/secret-version.response";

@Injectable({
  providedIn: "root",
})
export class SecretVersionService {
  constructor(
    private keyService: KeyService,
    private apiService: ApiService,
    private encryptService: EncryptService,
    private accountService: AccountService,
  ) {}

  private getOrganizationKey$(organizationId: string) {
    return this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.keyService.orgKeys$(userId)),
      filter((orgKeys): orgKeys is Record<OrganizationId, OrgKey> => orgKeys != null),
      map((organizationKeysById) => organizationKeysById[organizationId as OrganizationId]),
    );
  }

  private async getOrganizationKey(organizationId: string): Promise<SymmetricCryptoKey> {
    return await firstValueFrom(this.getOrganizationKey$(organizationId));
  }

  async getSecretVersions(organizationId: string, secretId: string): Promise<SecretVersionView[]> {
    const r = await this.apiService.send("GET", `/secrets/${secretId}/versions`, null, true, true);

    const response = new SecretVersionListResponse(r);
    const views = await this.createSecretVersionViews(organizationId, response.versions);

    // The API does not guarantee an order, so sort newest first to match how the
    // history is presented.
    return views.sort(
      (a, b) => new Date(b.versionDate).getTime() - new Date(a.versionDate).getTime(),
    );
  }

  private async createSecretVersionViews(
    organizationId: string,
    versionResponses: SecretVersionResponse[],
  ): Promise<SecretVersionView[]> {
    const orgKey = await this.getOrganizationKey(organizationId);

    return await Promise.all(
      versionResponses.map(async (response) => {
        return await this.createSecretVersionView(response, orgKey);
      }),
    );
  }

  private async createSecretVersionView(
    response: SecretVersionResponse,
    orgKey: SymmetricCryptoKey,
  ): Promise<SecretVersionView> {
    const view = new SecretVersionView();
    view.id = response.id;
    view.secretId = response.secretId;
    view.versionDate = response.versionDate;

    // Decrypt the value
    view.value = await this.decryptField(new EncString(response.value), orgKey);

    return view;
  }

  /**
   * Decrypts a single field, returning a sentinel rather than throwing so that one
   * undecryptable version does not discard the entire history.
   */
  private async decryptField(encString: EncString, orgKey: SymmetricCryptoKey): Promise<string> {
    try {
      return await this.encryptService.decryptString(encString, orgKey);
    } catch {
      return DECRYPT_ERROR;
    }
  }
}
