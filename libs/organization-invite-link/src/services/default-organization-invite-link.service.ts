import { concatMap, firstValueFrom, map, Observable, of, switchMap } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { asUuid, SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  OrganizationId as SdkOrganizationId,
  OrganizationInviteLinkView as SdkOrganizationInviteLinkView,
} from "@bitwarden/sdk-internal";
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
      switchMap((cached) => (cached == null ? this.get(userId, orgId) : of(cached))),
    );
  }

  async create(
    userId: UserId,
    orgId: OrganizationId,
    allowedDomains: string[],
    supportsConfirmation: boolean,
  ): Promise<void> {
    if (allowedDomains.length === 0) {
      throw new Error("At least one allowed domain is required.");
    }

    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value
            .invite_link()
            .admin()
            .create(asUuid<SdkOrganizationId>(orgId), allowedDomains, supportsConfirmation);
        }),
        concatMap((sdkView) => this.upsert(userId, sdkView)),
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

    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value
            .invite_link()
            .admin()
            .update_allowed_domains(asUuid<SdkOrganizationId>(orgId), allowedDomains);
        }),
        concatMap((sdkView) => this.upsert(userId, sdkView)),
      ),
    );
  }

  async setInviteConfirmation(
    userId: UserId,
    orgId: OrganizationId,
    supportsConfirmation: boolean,
  ): Promise<void> {
    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          using ref = sdk.take();
          const inviteLink = ref.value
            .invite_link()
            .admin()
            .update_confirmation(asUuid<SdkOrganizationId>(orgId), supportsConfirmation);
          return await inviteLink;
        }),
        concatMap((sdkView) => this.upsert(userId, sdkView)),
      ),
    );
  }

  async refresh(
    userId: UserId,
    orgId: OrganizationId,
    supportsConfirmation: boolean,
  ): Promise<void> {
    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value
            .invite_link()
            .admin()
            .refresh(asUuid<SdkOrganizationId>(orgId), supportsConfirmation);
        }),
        concatMap((sdkView) => this.upsert(userId, sdkView)),
      ),
    );
  }

  private async upsert(
    userId: UserId,
    sdkView: SdkOrganizationInviteLinkView,
  ): Promise<OrganizationInviteLinkView> {
    const url = await this.buildUrl(sdkView.urlFragment);
    const view = OrganizationInviteLinkView.fromSdk(sdkView, url);

    await this.stateProvider.getUser(userId, ORGANIZATION_INVITE_LINK_KEY).update((state) => {
      const record = state ?? ({} as Record<OrganizationId, OrganizationInviteLinkView>);
      return { ...record, [view.organizationId]: view };
    });

    return view;
  }

  async delete(userId: UserId, orgId: OrganizationId): Promise<void> {
    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          using ref = sdk.take();
          await ref.value.invite_link().admin().delete(asUuid<SdkOrganizationId>(orgId));
        }),
      ),
    );
    await this.stateProvider
      .getUser(userId, ORGANIZATION_INVITE_LINK_KEY)
      .update((state) => (state == null ? state : { ...state, [orgId]: undefined }));
  }

  private async buildUrl(urlFragment: string): Promise<string> {
    const env = await firstValueFrom(this.environmentService.environment$);
    return `${env.getWebVaultUrl()}/${urlFragment}`;
  }

  private async get(
    userId: UserId,
    orgId: OrganizationId,
  ): Promise<OrganizationInviteLinkView | undefined> {
    const sdkView = await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.invite_link().admin().get(asUuid<SdkOrganizationId>(orgId));
        }),
      ),
    );

    if (sdkView == null) {
      return undefined;
    }

    return await this.upsert(userId, sdkView);
  }
}
