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
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import {
  ServiceAccountSecretsDetailsView,
  ServiceAccountView,
} from "../models/view/service-account.view";
import { BulkOperationStatus } from "../shared/dialogs/bulk-status-dialog.component";

import { ServiceAccountRequest } from "./models/requests/service-account.request";
import {
  ServiceAccountResponse,
  ServiceAccountSecretsDetailsResponse,
} from "./models/responses/service-account.response";

@Injectable({
  providedIn: "root",
})
export class ServiceAccountService {
  protected _serviceAccount: Subject<ServiceAccountView> = new Subject();

  serviceAccount$ = this._serviceAccount.asObservable();

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
      filter((orgKeys) => !!orgKeys),
      map((organizationKeysById) => organizationKeysById[organizationId as OrganizationId]),
    );
  }

  private async getOrganizationKey(organizationId: string): Promise<SymmetricCryptoKey> {
    return await firstValueFrom(this.getOrganizationKey$(organizationId));
  }

  async getServiceAccounts(
    organizationId: string,
    includeAccessToSecrets?: boolean,
  ): Promise<ServiceAccountSecretsDetailsView[]> {
    const params = new URLSearchParams();
    if (includeAccessToSecrets) {
      params.set("includeAccessToSecrets", "true");
    }

    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/service-accounts?" + params.toString(),
      null,
      true,
      true,
    );
    const results = new ListResponse(r, ServiceAccountSecretsDetailsResponse);
    return await this.createServiceAccountSecretsDetailsViews(organizationId, results.data);
  }

  async getByServiceAccountId(
    serviceAccountId: string,
    organizationId: string,
  ): Promise<ServiceAccountView> {
    const orgKey = await this.getOrganizationKey(organizationId);
    const r = await this.apiService.send(
      "GET",
      "/service-accounts/" + serviceAccountId,
      null,
      true,
      true,
    );

    return await this.createServiceAccountView(orgKey, new ServiceAccountResponse(r));
  }

  async update(
    serviceAccountId: string,
    organizationId: string,
    serviceAccountView: ServiceAccountView,
  ) {
    const orgKey = await this.getOrganizationKey(organizationId);
    const request = await this.getServiceAccountRequest(orgKey, serviceAccountView);
    const r = await this.apiService.send(
      "PUT",
      "/service-accounts/" + serviceAccountId,
      request,
      true,
      true,
    );
    this._serviceAccount.next(
      await this.createServiceAccountView(orgKey, new ServiceAccountResponse(r)),
    );
  }

  async create(
    organizationId: string,
    serviceAccountView: ServiceAccountView,
  ): Promise<ServiceAccountView> {
    const orgKey = await this.getOrganizationKey(organizationId);
    const request = await this.getServiceAccountRequest(orgKey, serviceAccountView);
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + organizationId + "/service-accounts",
      request,
      true,
      true,
    );

    const serviceAccount = await this.createServiceAccountView(
      orgKey,
      new ServiceAccountResponse(r),
    );
    this._serviceAccount.next(serviceAccount);

    return serviceAccount;
  }

  async delete(serviceAccounts: ServiceAccountView[]): Promise<BulkOperationStatus[]> {
    const ids = serviceAccounts.map((serviceAccount) => serviceAccount.id);
    const r = await this.apiService.send("POST", "/service-accounts/delete", ids, true, true);

    this._serviceAccount.next(null);

    return r.data.map((element: { id: string; error: string }) => {
      const bulkOperationStatus = new BulkOperationStatus();
      bulkOperationStatus.id = element.id;
      bulkOperationStatus.name = serviceAccounts.find((sa) => sa.id == element.id).name;
      bulkOperationStatus.errorMessage = element.error;
      return bulkOperationStatus;
    });
  }

  private async getServiceAccountRequest(
    organizationKey: SymmetricCryptoKey,
    serviceAccountView: ServiceAccountView,
  ) {
    const request = new ServiceAccountRequest();
    request.name = await this.encryptService.encryptString(
      serviceAccountView.name,
      organizationKey,
    );
    return request;
  }

  private async createServiceAccountView(
    organizationKey: SymmetricCryptoKey,
    serviceAccountResponse: ServiceAccountResponse,
  ): Promise<ServiceAccountView> {
    const serviceAccountView = new ServiceAccountView();
    serviceAccountView.id = serviceAccountResponse.id;
    serviceAccountView.organizationId = serviceAccountResponse.organizationId;
    serviceAccountView.creationDate = serviceAccountResponse.creationDate;
    serviceAccountView.revisionDate = serviceAccountResponse.revisionDate;
    serviceAccountView.name = serviceAccountResponse.name
      ? await this.encryptService.decryptString(
          new EncString(serviceAccountResponse.name),
          organizationKey,
        )
      : null;
    return serviceAccountView;
  }

  private async createServiceAccountSecretsDetailsView(
    organizationKey: SymmetricCryptoKey,
    response: ServiceAccountSecretsDetailsResponse,
  ): Promise<ServiceAccountSecretsDetailsView> {
    const view = new ServiceAccountSecretsDetailsView();
    view.id = response.id;
    view.organizationId = response.organizationId;
    view.creationDate = response.creationDate;
    view.revisionDate = response.revisionDate;
    view.accessToSecrets = response.accessToSecrets;
    view.name = response.name
      ? await this.encryptService.decryptString(new EncString(response.name), organizationKey)
      : null;
    return view;
  }

  private async createServiceAccountSecretsDetailsViews(
    organizationId: string,
    serviceAccountResponses: ServiceAccountSecretsDetailsResponse[],
  ): Promise<ServiceAccountSecretsDetailsView[]> {
    const orgKey = await this.getOrganizationKey(organizationId);
    return await Promise.all(
      serviceAccountResponses.map(async (s: ServiceAccountSecretsDetailsResponse) => {
        return await this.createServiceAccountSecretsDetailsView(orgKey, s);
      }),
    );
  }
}
