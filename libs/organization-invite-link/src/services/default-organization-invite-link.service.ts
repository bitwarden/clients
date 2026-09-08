import { concatMap, firstValueFrom, map, Observable, of, switchMap } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { asUuid, SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrganizationId as SdkOrganizationId } from "@bitwarden/sdk-internal";
import { StateProvider } from "@bitwarden/state";

import { OrganizationInviteLinkService } from "../abstractions/organization-invite-link.service";
import { OrganizationInviteLinkView } from "../models/organization-invite-link.view";
import { ORGANIZATION_INVITE_LINK_KEY } from "../state/organization-invite-link-state";

export class DefaultOrganizationInviteLinkService implements OrganizationInviteLinkService {
  constructor(
    private readonly stateProvider: StateProvider,
    private readonly environmentService: EnvironmentService,
    private readonly sdkService: SdkService,
  ) {}

  inviteLink$(
    userId: UserId,
    orgId: OrganizationId,
  ): Observable<OrganizationInviteLinkView | undefined> {
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
    if (allowedDomains.length === 0) {
      throw new Error("At least one allowed domain is required.");
    }

    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value
            .invite_link()
            .create(asUuid<SdkOrganizationId>(orgId), allowedDomains, supportsConfirmation);
        }),
        concatMap(async (view) => {
          const url = await this.buildUrl(view.urlFragment);
          await this.upsert(userId, OrganizationInviteLinkView.fromSdk(view, url));
        }),
      ),
    );
  }

  async updateAllowedDomains(
    userId: UserId,
    orgId: OrganizationId,
    allowedDomains: string[],
  ): Promise<void> {
    if (allowedDomains.length === 0) {
      throw new Error("At least one allowed domain is required.");
    }

    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value
            .invite_link()
            .update_allowed_domains(asUuid<SdkOrganizationId>(orgId), allowedDomains);
        }),
        concatMap(async (view) => {
          const url = await this.buildUrl(view.urlFragment);
          await this.upsert(userId, OrganizationInviteLinkView.fromSdk(view, url));
        }),
      ),
    );
  }

  async refreshInviteLink(
    userId: UserId,
    orgId: OrganizationId,
    supportsConfirmation: boolean,
  ): Promise<void> {
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value
            .invite_link()
            .refresh(asUuid<SdkOrganizationId>(orgId), supportsConfirmation);
        }),
        concatMap(async (view) => {
          const url = await this.buildUrl(view.urlFragment);
          await this.upsert(userId, OrganizationInviteLinkView.fromSdk(view, url));
        }),
      ),
    );
  }

  async upsert(userId: UserId, data: OrganizationInviteLinkView): Promise<void> {
    await this.stateProvider.getUser(userId, ORGANIZATION_INVITE_LINK_KEY).update((state) => {
      const record = state ?? ({} as Record<OrganizationId, OrganizationInviteLinkView>);
      return { ...record, [data.organizationId]: data };
    });
  }

  async delete(userId: UserId, orgId: OrganizationId): Promise<void> {
    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          using ref = sdk.take();
          await ref.value.invite_link().delete(asUuid<SdkOrganizationId>(orgId));
        }),
      ),
    );
    await this.stateProvider
      .getUser(userId, ORGANIZATION_INVITE_LINK_KEY)
      .update((state) => (state == null ? state : { ...state, [orgId]: undefined }));
  }

  private async buildUrl(urlFragment: string): Promise<string> {
    const env = await firstValueFrom(this.environmentService.environment$);
    return `${env.getWebVaultUrl()}${urlFragment}`;
  }

  private async getInviteLink(
    userId: UserId,
    orgId: OrganizationId,
  ): Promise<OrganizationInviteLinkView | undefined> {
    const view = await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.invite_link().get(asUuid<SdkOrganizationId>(orgId));
        }),
      ),
    );

    if (view == null) {
      return undefined;
    }

    const url = await this.buildUrl(view.urlFragment);
    const inviteLink = OrganizationInviteLinkView.fromSdk(view, url);
    await this.upsert(userId, inviteLink);
    return inviteLink;
  }
}
