// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { KeyService } from "@bitwarden/key-management";

import { SecretAccessPoliciesView } from "../models/view/access-policies/secret-access-policies.view";
import { SecretListView } from "../models/view/secret-list.view";
import { SecretProjectView } from "../models/view/secret-project.view";
import { SecretView } from "../models/view/secret.view";
import { AccessPolicyService } from "../shared/access-policies/access-policy.service";
import { BulkOperationStatus } from "../shared/dialogs/bulk-status-dialog.component";

import { SecretRequest } from "./requests/secret.request";
import { SecretListItemResponse } from "./responses/secret-list-item.response";
import { SecretProjectResponse } from "./responses/secret-project.response";
import { SecretWithProjectsListResponse } from "./responses/secret-with-projects-list.response";
import { SecretResponse } from "./responses/secret.response";

@Injectable({
  providedIn: "root",
})
export class SecretService {
  protected _secret: Subject<SecretView> = new Subject();

  secret$ = this._secret.asObservable();

  constructor(
    private keyService: KeyService,
    private apiService: ApiService,
    private encryptService: EncryptService,
    private accessPolicyService: AccessPolicyService,
  ) {}

  async getBySecretId(secretId: string): Promise<SecretView> {
    const r = await this.apiService.send("GET", "/secrets/" + secretId, null, true, true);
    const secretResponse = new SecretResponse(r);

    return await this.createSecretView(secretResponse);
  }

  async getSecrets(organizationId: string): Promise<SecretListView[]> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/secrets",
      null,
      true,
      true,
    );

    const results = new SecretWithProjectsListResponse(r);
    return await this.createSecretsListView(organizationId, results);
  }

  async getSecretsByProject(organizationId: string, projectId: string): Promise<SecretListView[]> {
    const r = await this.apiService.send(
      "GET",
      "/projects/" + projectId + "/secrets",
      null,
      true,
      true,
    );

    const results = new SecretWithProjectsListResponse(r);
    return await this.createSecretsListView(organizationId, results);
  }

  async create(
    organizationId: string,
    secretView: SecretView,
    secretAccessPoliciesView: SecretAccessPoliciesView,
  ) {
    const request = await this.getSecretRequest(
      organizationId,
      secretView,
      secretAccessPoliciesView,
    );
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + organizationId + "/secrets",
      request,
      true,
      true,
    );
    this._secret.next(await this.createSecretView(new SecretResponse(r)));
  }

  async update(
    organizationId: string,
    secretView: SecretView,
    secretAccessPoliciesView: SecretAccessPoliciesView,
  ) {
    const request = await this.getSecretRequest(
      organizationId,
      secretView,
      secretAccessPoliciesView,
    );
    const r = await this.apiService.send("PUT", "/secrets/" + secretView.id, request, true, true);
    this._secret.next(await this.createSecretView(new SecretResponse(r)));
  }

  async delete(secrets: SecretListView[]): Promise<BulkOperationStatus[]> {
    const secretIds = secrets.map((secret) => secret.id);
    const r = await this.apiService.send("POST", "/secrets/delete", secretIds, true, true);

    this._secret.next(null);
    return r.data.map((element: { id: string; error: string }) => {
      const bulkOperationStatus = new BulkOperationStatus();
      bulkOperationStatus.id = element.id;
      bulkOperationStatus.name = secrets.find((secret) => secret.id == element.id).name;
      bulkOperationStatus.errorMessage = element.error;
      return bulkOperationStatus;
    });
  }

  async getTrashedSecrets(organizationId: string): Promise<SecretListView[]> {
    const r = await this.apiService.send(
      "GET",
      "/secrets/" + organizationId + "/trash",
      null,
      true,
      true,
    );

    return await this.createSecretsListView(organizationId, new SecretWithProjectsListResponse(r));
  }

  async deleteTrashed(organizationId: string, secretIds: string[]) {
    await this.apiService.send(
      "POST",
      "/secrets/" + organizationId + "/trash/empty",
      secretIds,
      true,
      true,
    );

    this._secret.next(null);
  }

  async restoreTrashed(organizationId: string, secretIds: string[]) {
    await this.apiService.send(
      "POST",
      "/secrets/" + organizationId + "/trash/restore",
      secretIds,
      true,
      true,
    );

    this._secret.next(null);
  }

  private async getOrganizationKey(organizationId: string): Promise<SymmetricCryptoKey> {
    return await this.keyService.getOrgKey(organizationId);
  }

  private async getSecretRequest(
    organizationId: string,
    secretView: SecretView,
    secretAccessPoliciesView: SecretAccessPoliciesView,
  ): Promise<SecretRequest> {
    const orgKey = await this.getOrganizationKey(organizationId);
    const request = new SecretRequest();
    const [key, value, note] = await Promise.all([
      this.encryptService.encrypt(secretView.name, orgKey),
      this.encryptService.encrypt(secretView.value, orgKey),
      this.encryptService.encrypt(secretView.note, orgKey),
    ]);
    request.key = key.encryptedString;
    request.value = value.encryptedString;
    request.note = note.encryptedString;
    request.projectIds = [];

    secretView.projects?.forEach((e) => request.projectIds.push(e.id));

    request.accessPoliciesRequests =
      this.accessPolicyService.getSecretAccessPoliciesRequest(secretAccessPoliciesView);

    return request;
  }

  private async createSecretView(secretResponse: SecretResponse): Promise<SecretView> {
    const orgKey = await this.getOrganizationKey(secretResponse.organizationId);

    const secretView = new SecretView();
    secretView.id = secretResponse.id;
    secretView.organizationId = secretResponse.organizationId;
    secretView.creationDate = secretResponse.creationDate;
    secretView.revisionDate = secretResponse.revisionDate;

    const [name, value, note] = await Promise.all([
      this.encryptService.decryptToUtf8(new EncString(secretResponse.name), orgKey),
      this.encryptService.decryptToUtf8(new EncString(secretResponse.value), orgKey),
      this.encryptService.decryptToUtf8(new EncString(secretResponse.note), orgKey),
    ]);
    secretView.name = name;
    secretView.value = value;
    secretView.note = note;

    secretView.read = secretResponse.read;
    secretView.write = secretResponse.write;

    if (secretResponse.projects != null) {
      secretView.projects = await this.decryptProjectsMappedToSecrets(
        orgKey,
        secretResponse.projects,
      );
    }

    return secretView;
  }

  private async createSecretsListView(
    organizationId: string,
    secrets: SecretWithProjectsListResponse,
  ): Promise<SecretListView[]> {
    const orgKey = await this.getOrganizationKey(organizationId);

    const projectsMappedToSecretsView = await this.decryptProjectsMappedToSecrets(
      orgKey,
      secrets.projects,
    );

    return await Promise.all(
      secrets.secrets.map(async (s: SecretListItemResponse) => {
        const secretListView = new SecretListView();
        secretListView.id = s.id;
        secretListView.organizationId = s.organizationId;
        secretListView.name = await this.encryptService.decryptToUtf8(
          new EncString(s.name),
          orgKey,
        );
        secretListView.creationDate = s.creationDate;
        secretListView.revisionDate = s.revisionDate;

        const projectIds = s.projects?.map((p) => p.id);
        secretListView.projects = projectsMappedToSecretsView.filter((p) =>
          projectIds.includes(p.id),
        );

        secretListView.read = s.read;
        secretListView.write = s.write;

        return secretListView;
      }),
    );
  }

  private async decryptProjectsMappedToSecrets(
    orgKey: SymmetricCryptoKey,
    projects: SecretProjectResponse[],
  ): Promise<SecretProjectView[]> {
    return await Promise.all(
      projects.map(async (s: SecretProjectResponse) => {
        const projectsMappedToSecretView = new SecretProjectView();
        projectsMappedToSecretView.id = s.id;
        projectsMappedToSecretView.name = s.name
          ? await this.encryptService.decryptToUtf8(new EncString(s.name), orgKey)
          : null;
        return projectsMappedToSecretView;
      }),
    );
  }
}
