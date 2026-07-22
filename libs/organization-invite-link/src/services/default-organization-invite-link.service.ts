import { firstValueFrom, map, Observable, of, switchMap } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { asUuid, SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { Invite, OrganizationId as SdkOrganizationId } from "@bitwarden/sdk-internal";
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
    private readonly apiService: OrganizationInviteLinkApiService,
    private readonly stateProvider: StateProvider,
    private readonly environmentService: EnvironmentService,
    private readonly sdkService: SdkService,
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
    supportsConfirmation: boolean,
  ): Promise<void> {
    const invite = await firstValueFrom(this.makeInvite(userId, orgId));
    const request = new OrganizationInviteLinkCreateRequest({
      allowedDomains,
      invite,
      supportsConfirmation,
    });
    const response = await this.apiService.create(orgId, request);
    await this.upsert(userId, new OrganizationInviteLink(response));
  }

  async updateAllowedDomains(
    userId: UserId,
    orgId: OrganizationId,
    allowedDomains: string[],
  ): Promise<void> {
    if (allowedDomains.length === 0) {
      throw new Error("At least one allowed domain is required.");
    }
    const request = new OrganizationInviteLinkUpdateRequest({
      allowedDomains,
    });
    const response = await this.apiService.updateAllowedDomains(orgId, request);
    await this.upsert(userId, new OrganizationInviteLink(response));
  }

  async refreshInviteLink(
    userId: UserId,
    orgId: OrganizationId,
    supportsConfirmation: boolean,
  ): Promise<void> {
    const invite = await firstValueFrom(this.makeInvite(userId, orgId));
    const request = new OrganizationInviteLinkRefreshRequest({
      invite,
      supportsConfirmation,
    });
    const response = await this.apiService.refresh(orgId, request);
    await this.upsert(userId, new OrganizationInviteLink(response));
  }

  reconstructUrl(
    userId: UserId,
    orgId: OrganizationId,
    inviteLink: OrganizationInviteLink,
  ): Observable<string> {
    return this.sdkService.userClient$(userId).pipe(
      map((sdk) => {
        using ref = sdk.take();
        return ref.value
          .invite_link()
          .get_invite_key(asUuid<SdkOrganizationId>(orgId), inviteLink.invite);
      }),
      switchMap((inviteKey) => this.buildInviteUrl(orgId, inviteLink.code, inviteKey)),
    );
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

  private buildInviteUrl(orgId: string, code: string, keyB64: string): Observable<string> {
    return this.environmentService.environment$.pipe(
      map((env) => `${env.getWebVaultUrl()}/#/join/${orgId}/${code}?key=${keyB64}`),
    );
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

  private makeInvite(userId: UserId, orgId: OrganizationId): Observable<Invite> {
    return this.sdkService.userClient$(userId).pipe(
      map((sdk) => {
        using ref = sdk.take();
        const bundle = ref.value.invite_link().make_invite(asUuid<SdkOrganizationId>(orgId));
        return bundle.invite;
      }),
    );
  }
}
