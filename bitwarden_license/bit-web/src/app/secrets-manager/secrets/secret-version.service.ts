import { Injectable } from "@angular/core";
import { filter, firstValueFrom, map, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, EncString, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

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
    return await this.createSecretVersionViews(organizationId, response.versions);
  }

  /**
   * Restores a secret to a specific version
   * @param secretId - Secret ID to restore
   * @param versionId - Version ID to restore to
   */
  async restoreVersion(secretId: string, versionId: string): Promise<void> {
    const request = { versionId };
    await this.apiService.send("PUT", `/secrets/${secretId}/versions/restore`, request, true, true);
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
    view.editorName = response.editorName;

    // Decrypt the value
    view.value = await this.encryptService.decryptString(new EncString(response.value), orgKey);

    return view;
  }
}
