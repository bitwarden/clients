// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { firstValueFrom, map } from "rxjs";
import { switchMap } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { CreateProviderOrganizationRequest } from "@bitwarden/common/admin-console/models/request/create-provider-organization.request";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { PlanType } from "@bitwarden/common/billing/enums";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { KeyService } from "@bitwarden/key-management";

@Injectable()
export class WebProviderService {
  constructor(
    private keyService: KeyService,
    private syncService: SyncService,
    private apiService: ApiService,
    private i18nService: I18nService,
    private encryptService: EncryptService,
    private stateProvider: StateProvider,
    private providerApiService: ProviderApiServiceAbstraction,
  ) {}

  async addOrganizationToProvider(providerId: string, organizationId: string): Promise<void> {
    const orgKey = await firstValueFrom(
      this.stateProvider.activeUserId$.pipe(
        switchMap((userId) => this.keyService.orgKeys$(userId)),
        map((organizationKeysById) => organizationKeysById[organizationId as OrganizationId]),
      ),
    );
    const providerKey = await this.keyService.getProviderKey(providerId);
    const encryptedOrgKey = await this.encryptService.wrapSymmetricKey(orgKey, providerKey);
    await this.providerApiService.addOrganizationToProvider(providerId, {
      key: encryptedOrgKey.encryptedString,
      organizationId,
    });
    await this.syncService.fullSync(true);
  }

  async createClientOrganization(
    providerId: string,
    name: string,
    ownerEmail: string,
    planType: PlanType,
    seats: number,
    activeUserId: UserId,
  ): Promise<void> {
    const organizationKey = (await this.keyService.makeOrgKey<OrgKey>(activeUserId))[1];

    const [publicKey, encryptedPrivateKey] = await this.keyService.makeKeyPair(organizationKey);

    const encryptedCollectionName = await this.encryptService.encryptString(
      this.i18nService.t("defaultCollection"),
      organizationKey,
    );

    const providerKey = await this.keyService.getProviderKey(providerId);

    const encryptedProviderKey = await this.encryptService.wrapSymmetricKey(
      organizationKey,
      providerKey,
    );

    const request = new CreateProviderOrganizationRequest();
    request.name = name;
    request.ownerEmail = ownerEmail;
    request.planType = planType;
    request.seats = seats;

    request.key = encryptedProviderKey.encryptedString;
    request.keyPair = new OrganizationKeysRequest(publicKey, encryptedPrivateKey.encryptedString);
    request.collectionName = encryptedCollectionName.encryptedString;

    await this.providerApiService.createProviderOrganization(providerId, request);

    await this.apiService.refreshIdentityToken();

    await this.syncService.fullSync(true);
  }

  async detachOrganization(providerId: string, organizationId: string): Promise<any> {
    await this.apiService.deleteProviderOrganization(providerId, organizationId);
    await this.syncService.fullSync(true);
  }
}
