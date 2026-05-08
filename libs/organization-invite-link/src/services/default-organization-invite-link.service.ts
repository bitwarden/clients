import { firstValueFrom, map, Observable } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
import { StateProvider } from "@bitwarden/state";

import { OrganizationInviteLinkApiService } from "../abstractions/organization-invite-link-api.service";
import { OrganizationInviteLinkService } from "../abstractions/organization-invite-link.service";
import { OrganizationInviteLinkCreateRequest } from "../models/requests/organization-invite-link-create.request";
import { OrganizationInviteLinkRefreshRequest } from "../models/requests/organization-invite-link-refresh.request";
import { OrganizationInviteLinkResponseModel } from "../models/responses/organization-invite-link.response";
import { ORGANIZATION_INVITE_LINK_KEY } from "../state/organization-invite-link-state";

export class DefaultOrganizationInviteLinkService implements OrganizationInviteLinkService {
  constructor(
    private readonly keyService: KeyService,
    private readonly encryptService: EncryptService,
    private readonly keyGenerationService: KeyGenerationService,
    private readonly apiService: OrganizationInviteLinkApiService,
    private readonly stateProvider: StateProvider,
  ) {}

  inviteLink$(userId: UserId): Observable<OrganizationInviteLinkResponseModel | undefined> {
    return this.stateProvider
      .getUser(userId, ORGANIZATION_INVITE_LINK_KEY)
      .state$.pipe(map((state) => state ?? undefined));
  }

  async createInviteLink(
    userId: UserId,
    orgId: OrganizationId,
    domains: string[],
  ): Promise<string> {
    const { rawInviteKey, encryptedInviteKey } = await this.generateEncryptedKeyBundle(
      userId,
      orgId,
    );

    const request = new OrganizationInviteLinkCreateRequest({
      allowedDomains: domains,
      encryptedInviteKey,
    });

    const response = await this.apiService.create(orgId, request);
    await this.upsert(userId, response);

    return this.buildInviteUrl(response.code, rawInviteKey.keyB64);
  }

  async refreshInviteLink(userId: UserId, orgId: OrganizationId): Promise<string> {
    const { rawInviteKey, encryptedInviteKey } = await this.generateEncryptedKeyBundle(
      userId,
      orgId,
    );

    const request = new OrganizationInviteLinkRefreshRequest({ encryptedInviteKey });

    const response = await this.apiService.refresh(orgId, request);
    await this.upsert(userId, response);

    return this.buildInviteUrl(response.code, rawInviteKey.keyB64);
  }

  async reconstructUrl(userId: UserId, orgId: OrganizationId): Promise<string | undefined> {
    const response = await this.apiService.get(orgId);
    if (response == null) {
      return;
    }

    await this.upsert(userId, response);

    const orgKey = await firstValueFrom(
      this.keyService.orgKeys$(userId).pipe(
        map((orgKeys) => {
          const orgKey = orgKeys?.[orgId] ?? undefined;
          if (orgKey == null) {
            throw new Error(`Organization key not found for org ${orgId}`);
          }

          return orgKey;
        }),
      ),
    );

    const encKey = new EncString(response.encryptedInviteKey);
    const rawInviteKey = await this.encryptService.unwrapSymmetricKey(encKey, orgKey);

    return this.buildInviteUrl(response.code, rawInviteKey.keyB64);
  }

  private buildInviteUrl(code: string, keyB64: string): string {
    return `/#/join/${code}?key=${keyB64}`;
  }

  async upsert(userId: UserId, data: OrganizationInviteLinkResponseModel): Promise<void> {
    await this.stateProvider.getUser(userId, ORGANIZATION_INVITE_LINK_KEY).update(() => data);
  }

  async delete(userId: UserId, orgId: OrganizationId): Promise<void> {
    await this.apiService.delete(orgId);
    await this.clear(userId);
  }

  async clear(userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, ORGANIZATION_INVITE_LINK_KEY).update(() => undefined);
  }

  /**
   * Generates a raw symmetric key and wraps it with the organization key.
   *
   * TODO: Replace with `generateOrganizationInviteCryptoBundle` from the SDK once available.
   */
  private async generateEncryptedKeyBundle(
    userId: UserId,
    orgId: OrganizationId,
  ): Promise<{ rawInviteKey: SymmetricCryptoKey; encryptedInviteKey: EncString }> {
    const rawInviteKey = await this.keyGenerationService.createKey(256);

    const orgKey = await firstValueFrom(
      this.keyService.orgKeys$(userId).pipe(
        map((orgKeys) => {
          const key: OrgKey | undefined = orgKeys?.[orgId as OrganizationId] ?? undefined;
          if (key == null) {
            throw new Error(`Organization key not found for org ${orgId}`);
          }
          return key;
        }),
      ),
    );

    const encryptedInviteKey = await this.encryptService.wrapSymmetricKey(rawInviteKey, orgKey);
    return { rawInviteKey, encryptedInviteKey };
  }
}
