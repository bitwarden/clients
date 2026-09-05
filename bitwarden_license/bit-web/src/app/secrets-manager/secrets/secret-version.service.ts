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

export interface SecretVersionHistory {
  currentValueAuthorName?: string;
  versions: SecretVersionView[];
}

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

  async getSecretVersions(organizationId: string, secretId: string): Promise<SecretVersionHistory> {
    const r = await this.apiService.send("GET", `/secrets/${secretId}/versions`, null, true, true);

    const response = new SecretVersionListResponse(r);
    const orgKey = await this.getOrganizationKey(organizationId);

    const orderedNewestFirst = [...response.versions].sort(
      (a, b) => new Date(b.versionDate).getTime() - new Date(a.versionDate).getTime(),
    );

    return await this.buildHistory(orderedNewestFirst, orgKey);
  }

  private async buildHistory(
    orderedNewestFirst: SecretVersionResponse[],
    orgKey: SymmetricCryptoKey,
  ): Promise<SecretVersionHistory> {
    const [currentValue, ...previousValues] = orderedNewestFirst;

    const currentValueAuthorName = currentValue
      ? await this.resolveEditorName(currentValue, orgKey)
      : undefined;

    const versions = await Promise.all(
      previousValues.map(async (response) => {
        const view = await this.createSecretVersionView(response, orgKey);
        view.authorName = await this.resolveEditorName(response, orgKey);
        return view;
      }),
    );

    return { currentValueAuthorName, versions };
  }

  private async resolveEditorName(
    response: SecretVersionResponse,
    orgKey: SymmetricCryptoKey,
  ): Promise<string | undefined> {
    if (response.editorOrganizationUserName) {
      return response.editorOrganizationUserName;
    }

    if (response.editorServiceAccountName) {
      return await this.decryptField(new EncString(response.editorServiceAccountName), orgKey);
    }

    return undefined;
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
   * Decrypts one piece of text. If it cannot be decrypted, this returns a
   * placeholder instead of failing, so one bad version does not stop the rest
   * of the history from loading.
   */
  private async decryptField(encString: EncString, orgKey: SymmetricCryptoKey): Promise<string> {
    try {
      return await this.encryptService.decryptString(encString, orgKey);
    } catch {
      return DECRYPT_ERROR;
    }
  }
}
