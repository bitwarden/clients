import { firstValueFrom, map, Observable, of, switchMap } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";
import { StateProvider } from "@bitwarden/state";

import { OrganizationInviteLinkApiService } from "../abstractions/organization-invite-link-api.service";
import { OrganizationInviteLinkService } from "../abstractions/organization-invite-link.service";
import { OrganizationInviteLinkCreateRequest } from "../models/requests/organization-invite-link-create.request";
import { OrganizationInviteLinkRefreshRequest } from "../models/requests/organization-invite-link-refresh.request";
import { OrganizationInviteLinkUpdateRequest } from "../models/requests/organization-invite-link-update.request";
import {
  OrganizationInviteLink,
  OrganizationInviteLinkResponseModel,
} from "../models/responses/organization-invite-link.response";
import { ORGANIZATION_INVITE_LINK_KEY } from "../state/organization-invite-link-state";

export class DefaultOrganizationInviteLinkService implements OrganizationInviteLinkService {
  constructor(
    private readonly keyService: KeyService,
    private readonly encryptService: EncryptService,
    private readonly keyGenerationService: KeyGenerationService,
    private readonly apiService: OrganizationInviteLinkApiService,
    private readonly stateProvider: StateProvider,
  ) {}

  inviteLink$(
    userId: UserId,
    orgId: OrganizationId,
  ): Observable<OrganizationInviteLink | undefined> {
    return this.stateProvider.getUser(userId, ORGANIZATION_INVITE_LINK_KEY).state$.pipe(
      map((record) => record?.[orgId]),
      switchMap((cached) => (cached == null ? this.getInviteLink(userId, orgId) : of(cached))),
    );
  }

  async createInviteLink(
    userId: UserId,
    orgId: OrganizationId,
    allowedDomains: string[],
  ): Promise<void> {
    const encryptedInviteKey = await this.generateEncryptedKey(userId, orgId);
    const request = new OrganizationInviteLinkCreateRequest({ allowedDomains, encryptedInviteKey });
    const response = await this.apiService.create(orgId, request);
    const inviteLink = new OrganizationInviteLink(response);

    await this.upsert(userId, inviteLink);
  }

  async updateInviteLink(
    userId: UserId,
    orgId: OrganizationId,
    allowedDomains: string[],
  ): Promise<void> {
    const request = new OrganizationInviteLinkUpdateRequest({ allowedDomains });
    const response = await this.apiService.update(orgId, request);
    const inviteLink = new OrganizationInviteLink(response);

    await this.upsert(userId, inviteLink);
  }

  async refreshInviteLink(userId: UserId, orgId: OrganizationId) {
    const encryptedInviteKey = await this.generateEncryptedKey(userId, orgId);
    const request = new OrganizationInviteLinkRefreshRequest({ encryptedInviteKey });
    const response = await this.apiService.refresh(orgId, request);
    const inviteLink = new OrganizationInviteLink(response);

    await this.upsert(userId, inviteLink);
  }

  async reconstructUrl(userId: UserId, orgId: OrganizationId): Promise<string> {
    const inviteLink = await firstValueFrom(
      this.inviteLink$(userId, orgId).pipe(
        map((inviteLink) => {
          if (inviteLink == null) {
            throw new Error("Organization does not have an invite link to reconstruct");
          }
          return inviteLink;
        }),
      ),
    );
    const orgKey = await firstValueFrom(this.getOrgKey(userId, orgId));
    const encKey = new EncString(inviteLink.encryptedInviteKey);
    const rawInviteKey = await this.encryptService.unwrapSymmetricKey(encKey, orgKey);

    return this.buildInviteUrl(inviteLink.code, rawInviteKey.keyB64);
  }

  async upsert(userId: UserId, data: OrganizationInviteLink): Promise<void> {
    await this.stateProvider.getUser(userId, ORGANIZATION_INVITE_LINK_KEY).update((state) => {
      const record = state ?? ({} as Record<OrganizationId, OrganizationInviteLink>);
      return { ...record, [data.organizationId]: data };
    });
  }

  async delete(userId: UserId, orgId: OrganizationId): Promise<void> {
    await this.apiService.delete(orgId);
    await this.stateProvider
      .getUser(userId, ORGANIZATION_INVITE_LINK_KEY)
      .update((state) => (state == null ? state : { ...state, [orgId]: undefined }));
  }

  private buildInviteUrl(code: string, keyB64: string): string {
    return `/#/join/${code}?key=${keyB64}`;
  }

  private async getInviteLink(
    userId: UserId,
    orgId: OrganizationId,
  ): Promise<OrganizationInviteLink | undefined> {
    let response: OrganizationInviteLinkResponseModel;
    try {
      response = await this.apiService.get(orgId);
    } catch (e) {
      if (e instanceof ErrorResponse && e.statusCode === 404) {
        return undefined;
      }
      throw e;
    }

    const inviteLink = new OrganizationInviteLink(response);
    await this.upsert(userId, inviteLink);
    return inviteLink;
  }

  private getOrgKey(userId: UserId, orgId: OrganizationId) {
    return this.keyService.orgKeys$(userId).pipe(
      map((orgKeys) => {
        const orgKey = orgKeys?.[orgId] ?? undefined;
        if (orgKey == null) {
          throw new Error(`Organization key not found for org ${orgId}`);
        }

        return orgKey;
      }),
    );
  }

  /**
   * Generates and returns an encrypted invite key.
   *
   * TODO: Replace with `generateOrganizationInviteCryptoBundle` from the SDK once available.
   */
  private async generateEncryptedKey(userId: UserId, orgId: OrganizationId): Promise<EncString> {
    // Important: this rawInviteKey must never be sent to the server!
    const rawInviteKey = await this.keyGenerationService.createKey(256);
    const orgKey = await firstValueFrom(this.getOrgKey(userId, orgId));
    const encryptedInviteKey = await this.encryptService.wrapSymmetricKey(rawInviteKey, orgKey);
    return encryptedInviteKey;
  }
}
