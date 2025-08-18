// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { filter, firstValueFrom, map, Subject, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { AccessTokenRequest } from "../models/requests/access-token.request";
import { RevokeAccessTokensRequest } from "../models/requests/revoke-access-tokens.request";
import { AccessTokenCreationResponse } from "../models/responses/access-token-creation.response";
import { AccessTokenResponse } from "../models/responses/access-tokens.response";
import { AccessTokenView } from "../models/view/access-token.view";

@Injectable({
  providedIn: "root",
})
export class AccessService {
  private readonly _accessTokenVersion = "0";
  protected _accessToken: Subject<AccessTokenView> = new Subject();

  accessToken$ = this._accessToken.asObservable();

  constructor(
    private keyService: KeyService,
    private apiService: ApiService,
    private keyGenerationService: KeyGenerationService,
    private encryptService: EncryptService,
    private accountService: AccountService,
  ) {}

  async getAccessTokens(
    organizationId: string,
    serviceAccountId: string,
  ): Promise<AccessTokenView[]> {
    const r = await this.apiService.send(
      "GET",
      "/service-accounts/" + serviceAccountId + "/access-tokens",
      null,
      true,
      true,
    );
    const results = new ListResponse(r, AccessTokenResponse);

    return await this.createAccessTokenViews(organizationId, results.data);
  }

  private getOrganizationKey$(organizationId: string) {
    return this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.keyService.orgKeys$(userId)),
      filter((orgKeys) => !!orgKeys),
      map((organizationKeysById) => organizationKeysById[organizationId as OrganizationId]),
    );
  }

  private async getOrganizationKey(organizationId: string): Promise<SymmetricCryptoKey> {
    return await firstValueFrom(this.getOrganizationKey$(organizationId));
  }

  async createAccessToken(
    organizationId: string,
    serviceAccountId: string,
    accessTokenView: AccessTokenView,
  ): Promise<string> {
    const key = await this.keyGenerationService.createKeyWithPurpose(
      128,
      "sm-access-token",
      "bitwarden-accesstoken",
    );

    const request = await this.createAccessTokenRequest(
      organizationId,
      key.derivedKey,
      accessTokenView,
    );
    const r = await this.apiService.send(
      "POST",
      "/service-accounts/" + serviceAccountId + "/access-tokens",
      request,
      true,
      true,
    );
    const result = new AccessTokenCreationResponse(r);
    this._accessToken.next(null);
    const keyB64 = Utils.fromBufferToB64(key.material);
    return `${this._accessTokenVersion}.${result.id}.${result.clientSecret}:${keyB64}`;
  }

  async revokeAccessTokens(serviceAccountId: string, accessTokenIds: string[]): Promise<void> {
    const request = new RevokeAccessTokensRequest();
    request.ids = accessTokenIds;

    await this.apiService.send(
      "POST",
      "/service-accounts/" + serviceAccountId + "/access-tokens/revoke",
      request,
      true,
      false,
    );

    this._accessToken.next(null);
  }

  private async createAccessTokenRequest(
    organizationId: string,
    encryptionKey: SymmetricCryptoKey,
    accessTokenView: AccessTokenView,
  ): Promise<AccessTokenRequest> {
    const organizationKey = await this.getOrganizationKey(organizationId);
    const accessTokenRequest = new AccessTokenRequest();
    const [name, encryptedPayload, key] = await Promise.all([
      await this.encryptService.encryptString(accessTokenView.name, organizationKey),
      await this.encryptService.encryptString(
        JSON.stringify({ encryptionKey: organizationKey.keyB64 }),
        encryptionKey,
      ),
      await this.encryptService.encryptString(encryptionKey.keyB64, organizationKey),
    ]);

    accessTokenRequest.name = name;
    accessTokenRequest.encryptedPayload = encryptedPayload;
    accessTokenRequest.key = key;
    accessTokenRequest.expireAt = accessTokenView.expireAt;
    return accessTokenRequest;
  }

  private async createAccessTokenViews(
    organizationId: string,
    accessTokenResponses: AccessTokenResponse[],
  ): Promise<AccessTokenView[]> {
    const orgKey = await this.getOrganizationKey(organizationId);
    return await Promise.all(
      accessTokenResponses.map(async (s) => {
        const view = new AccessTokenView();
        view.id = s.id;
        view.name = await this.encryptService.decryptString(new EncString(s.name), orgKey);
        view.scopes = s.scopes;
        view.expireAt = s.expireAt ? new Date(s.expireAt) : null;
        view.creationDate = new Date(s.creationDate);
        view.revisionDate = new Date(s.revisionDate);
        return view;
      }),
    );
  }
}
