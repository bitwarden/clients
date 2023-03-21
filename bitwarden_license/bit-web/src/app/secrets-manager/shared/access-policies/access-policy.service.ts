import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CryptoService } from "@bitwarden/common/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/abstractions/encrypt.service";
import { OrganizationService } from "@bitwarden/common/abstractions/organization/organization.service.abstraction";
import { EncString } from "@bitwarden/common/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/models/domain/symmetric-crypto-key";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { Guid } from "@bitwarden/common/types/guid";

import {
  BaseAccessPolicyView,
  GroupProjectAccessPolicyView,
  GroupServiceAccountAccessPolicyView,
  ProjectAccessPoliciesView,
  ServiceAccountAccessPoliciesView,
  ServiceAccountProjectAccessPolicyView,
  UserProjectAccessPolicyView,
  UserServiceAccountAccessPolicyView,
} from "../../models/view/access-policy.view";
import { PotentialGranteeView } from "../../models/view/potential-grantee.view";
import { AccessPoliciesCreateRequest } from "../../shared/access-policies/models/requests/access-policies-create.request";
import { ProjectAccessPoliciesResponse } from "../../shared/access-policies/models/responses/project-access-policies.response";
import { ServiceAccountAccessPoliciesResponse } from "../../shared/access-policies/models/responses/service-accounts-access-policies.response";

import { AccessSelectorRowView } from "./access-selector.component";
import { AccessPolicyUpdateRequest } from "./models/requests/access-policy-update.request";
import { AccessPolicyRequest } from "./models/requests/access-policy.request";
import { GrantedPolicyRequest } from "./models/requests/granted-policy.request";
import {
  GroupServiceAccountAccessPolicyResponse,
  UserServiceAccountAccessPolicyResponse,
  GroupProjectAccessPolicyResponse,
  ServiceAccountProjectAccessPolicyResponse,
  UserProjectAccessPolicyResponse,
} from "./models/responses/access-policy.response";
import { PotentialGranteeResponse } from "./models/responses/potential-grantee.response";

@Injectable({
  providedIn: "root",
})
export class AccessPolicyService {
  private _projectAccessPolicyChanges$ = new Subject<ProjectAccessPoliciesView>();
  private _serviceAccountAccessPolicyChanges$ = new Subject<ServiceAccountAccessPoliciesView>();
  private _serviceAccountGrantedPolicyChanges$ = new Subject<
    ServiceAccountProjectAccessPolicyView[]
  >();

  /**
   * Emits when a project access policy is created or deleted.
   */
  readonly projectAccessPolicyChanges$ = this._projectAccessPolicyChanges$.asObservable();

  /**
   * Emits when a service account access policy is created or deleted.
   */
  readonly serviceAccountAccessPolicyChanges$ =
    this._serviceAccountAccessPolicyChanges$.asObservable();

  /**
   * Emits when a service account granted policy is created or deleted.
   */
  readonly serviceAccountGrantedPolicyChanges$ =
    this._serviceAccountGrantedPolicyChanges$.asObservable();

  constructor(
    private cryptoService: CryptoService,
    private organizationService: OrganizationService,
    protected apiService: ApiService,
    protected encryptService: EncryptService
  ) {}

  refreshProjectAccessPolicyChanges() {
    this._projectAccessPolicyChanges$.next(null);
  }

  refreshServiceAccountAccessPolicyChanges() {
    this._serviceAccountAccessPolicyChanges$.next(null);
  }

  async getGrantedPolicies(
    serviceAccountId: Guid,
    organizationId: Guid
  ): Promise<ServiceAccountProjectAccessPolicyView[]> {
    const r = await this.apiService.send(
      "GET",
      "/service-accounts/" + serviceAccountId + "/granted-policies",
      null,
      true,
      true
    );

    const results = new ListResponse(r, ServiceAccountProjectAccessPolicyResponse);
    return await this.createServiceAccountProjectAccessPolicyViews(results.data, organizationId);
  }

  async createGrantedPolicies(
    organizationId: Guid,
    serviceAccountId: Guid,
    policies: ServiceAccountProjectAccessPolicyView[]
  ): Promise<ServiceAccountProjectAccessPolicyView[]> {
    const request = this.getGrantedPoliciesCreateRequest(policies);
    const r = await this.apiService.send(
      "POST",
      "/service-accounts/" + serviceAccountId + "/granted-policies",
      request,
      true,
      true
    );
    const results = new ListResponse(r, ServiceAccountProjectAccessPolicyResponse);
    const views = await this.createServiceAccountProjectAccessPolicyViews(
      results.data,
      organizationId
    );
    this._serviceAccountGrantedPolicyChanges$.next(views);
    return views;
  }

  async getProjectAccessPolicies(
    organizationId: Guid,
    projectId: Guid
  ): Promise<ProjectAccessPoliciesView> {
    const r = await this.apiService.send(
      "GET",
      "/projects/" + projectId + "/access-policies",
      null,
      true,
      true
    );

    const results = new ProjectAccessPoliciesResponse(r);
    return await this.createProjectAccessPoliciesView(organizationId, results);
  }

  async getServiceAccountAccessPolicies(
    serviceAccountId: Guid
  ): Promise<ServiceAccountAccessPoliciesView> {
    const r = await this.apiService.send(
      "GET",
      "/service-accounts/" + serviceAccountId + "/access-policies",
      null,
      true,
      true
    );

    const results = new ServiceAccountAccessPoliciesResponse(r);
    return await this.createServiceAccountAccessPoliciesView(results);
  }

  async createProjectAccessPolicies(
    organizationId: Guid,
    projectId: Guid,
    projectAccessPoliciesView: ProjectAccessPoliciesView
  ): Promise<ProjectAccessPoliciesView> {
    const request = this.getAccessPoliciesCreateRequest(projectAccessPoliciesView);
    const r = await this.apiService.send(
      "POST",
      "/projects/" + projectId + "/access-policies",
      request,
      true,
      true
    );
    const results = new ProjectAccessPoliciesResponse(r);
    const view = await this.createProjectAccessPoliciesView(organizationId, results);
    this._projectAccessPolicyChanges$.next(view);
    return view;
  }

  async createServiceAccountAccessPolicies(
    serviceAccountId: Guid,
    serviceAccountAccessPoliciesView: ServiceAccountAccessPoliciesView
  ): Promise<ServiceAccountAccessPoliciesView> {
    const request = this.getServiceAccountAccessPoliciesCreateRequest(
      serviceAccountAccessPoliciesView
    );
    const r = await this.apiService.send(
      "POST",
      "/service-accounts/" + serviceAccountId + "/access-policies",
      request,
      true,
      true
    );
    const results = new ServiceAccountAccessPoliciesResponse(r);
    const view = await this.createServiceAccountAccessPoliciesView(results);
    this._serviceAccountAccessPolicyChanges$.next(view);
    return view;
  }

  async deleteAccessPolicy(accessPolicyId: Guid): Promise<void> {
    await this.apiService.send("DELETE", "/access-policies/" + accessPolicyId, null, true, false);
    this._projectAccessPolicyChanges$.next(null);
    this._serviceAccountAccessPolicyChanges$.next(null);
    this._serviceAccountGrantedPolicyChanges$.next(null);
  }

  async updateAccessPolicy(baseAccessPolicyView: BaseAccessPolicyView): Promise<void> {
    const payload = new AccessPolicyUpdateRequest();
    payload.read = baseAccessPolicyView.read;
    payload.write = baseAccessPolicyView.write;
    await this.apiService.send(
      "PUT",
      "/access-policies/" + baseAccessPolicyView.id,
      payload,
      true,
      true
    );
  }

  async needToShowAccessRemovalWarning(
    organizationId: Guid,
    policy: AccessSelectorRowView,
    currentPolicies: AccessSelectorRowView[]
  ): Promise<boolean> {
    const organization = this.organizationService.get(organizationId);
    if (organization.isOwner || organization.isAdmin) {
      return false;
    }
    const currentUserId = organization.userId;
    const readWriteGroupPolicies = currentPolicies
      .filter((x) => x.accessPolicyId != policy.accessPolicyId)
      .filter((x) => x.currentUserInGroup && x.read && x.write).length;
    const readWriteUserPolicies = currentPolicies
      .filter((x) => x.accessPolicyId != policy.accessPolicyId)
      .filter((x) => x.userId == currentUserId && x.read && x.write).length;

    if (policy.type === "user" && policy.userId == currentUserId && readWriteGroupPolicies == 0) {
      return true;
    } else if (
      policy.type === "group" &&
      policy.currentUserInGroup &&
      readWriteUserPolicies == 0 &&
      readWriteGroupPolicies == 0
    ) {
      return true;
    }
    return false;
  }

  private async createProjectAccessPoliciesView(
    organizationId: Guid,
    projectAccessPoliciesResponse: ProjectAccessPoliciesResponse
  ): Promise<ProjectAccessPoliciesView> {
    const orgKey = await this.getOrganizationKey(organizationId);
    const view = new ProjectAccessPoliciesView();

    view.userAccessPolicies = projectAccessPoliciesResponse.userAccessPolicies.map((ap) => {
      return this.createUserProjectAccessPolicyView(ap);
    });
    view.groupAccessPolicies = projectAccessPoliciesResponse.groupAccessPolicies.map((ap) => {
      return this.createGroupProjectAccessPolicyView(ap);
    });
    view.serviceAccountAccessPolicies = await Promise.all(
      projectAccessPoliciesResponse.serviceAccountAccessPolicies.map(async (ap) => {
        return await this.createServiceAccountProjectAccessPolicyView(orgKey, ap);
      })
    );
    return view;
  }

  private getAccessPoliciesCreateRequest(
    projectAccessPoliciesView: ProjectAccessPoliciesView
  ): AccessPoliciesCreateRequest {
    const createRequest = new AccessPoliciesCreateRequest();

    if (projectAccessPoliciesView.userAccessPolicies?.length > 0) {
      createRequest.userAccessPolicyRequests = projectAccessPoliciesView.userAccessPolicies.map(
        (ap) => {
          return this.getAccessPolicyRequest(ap.organizationUserId, ap);
        }
      );
    }

    if (projectAccessPoliciesView.groupAccessPolicies?.length > 0) {
      createRequest.groupAccessPolicyRequests = projectAccessPoliciesView.groupAccessPolicies.map(
        (ap) => {
          return this.getAccessPolicyRequest(ap.groupId, ap);
        }
      );
    }

    if (projectAccessPoliciesView.serviceAccountAccessPolicies?.length > 0) {
      createRequest.serviceAccountAccessPolicyRequests =
        projectAccessPoliciesView.serviceAccountAccessPolicies.map((ap) => {
          return this.getAccessPolicyRequest(ap.serviceAccountId, ap);
        });
    }
    return createRequest;
  }

  private createUserProjectAccessPolicyView(
    response: UserProjectAccessPolicyResponse
  ): UserProjectAccessPolicyView {
    return {
      ...this.createBaseAccessPolicyView(response),
      grantedProjectId: response.grantedProjectId,
      organizationUserId: response.organizationUserId,
      organizationUserName: response.organizationUserName,
      userId: response.userId,
    };
  }

  private createGroupProjectAccessPolicyView(
    response: GroupProjectAccessPolicyResponse
  ): GroupProjectAccessPolicyView {
    return {
      ...this.createBaseAccessPolicyView(response),
      grantedProjectId: response.grantedProjectId,
      groupId: response.groupId,
      groupName: response.groupName,
      currentUserInGroup: response.currentUserInGroup,
    };
  }

  private async createServiceAccountProjectAccessPolicyView(
    organizationKey: SymmetricCryptoKey,
    response: ServiceAccountProjectAccessPolicyResponse
  ): Promise<ServiceAccountProjectAccessPolicyView> {
    return {
      ...this.createBaseAccessPolicyView(response),
      grantedProjectId: response.grantedProjectId,
      serviceAccountId: response.serviceAccountId,
      grantedProjectName: response.grantedProjectName
        ? await this.encryptService.decryptToUtf8(
            new EncString(response.grantedProjectName),
            organizationKey
          )
        : null,
      serviceAccountName: await this.encryptService.decryptToUtf8(
        new EncString(response.serviceAccountName),
        organizationKey
      ),
    };
  }

  private getServiceAccountAccessPoliciesCreateRequest(
    serviceAccountAccessPoliciesView: ServiceAccountAccessPoliciesView
  ): AccessPoliciesCreateRequest {
    const createRequest = new AccessPoliciesCreateRequest();

    if (serviceAccountAccessPoliciesView.userAccessPolicies?.length > 0) {
      createRequest.userAccessPolicyRequests =
        serviceAccountAccessPoliciesView.userAccessPolicies.map((ap) => {
          return this.getAccessPolicyRequest(ap.organizationUserId, ap);
        });
    }

    if (serviceAccountAccessPoliciesView.groupAccessPolicies?.length > 0) {
      createRequest.groupAccessPolicyRequests =
        serviceAccountAccessPoliciesView.groupAccessPolicies.map((ap) => {
          return this.getAccessPolicyRequest(ap.groupId, ap);
        });
    }

    return createRequest;
  }

  private async createServiceAccountAccessPoliciesView(
    serviceAccountAccessPoliciesResponse: ServiceAccountAccessPoliciesResponse
  ): Promise<ServiceAccountAccessPoliciesView> {
    const view = new ServiceAccountAccessPoliciesView();
    view.userAccessPolicies = serviceAccountAccessPoliciesResponse.userAccessPolicies.map((ap) => {
      return this.createUserServiceAccountAccessPolicyView(ap);
    });
    view.groupAccessPolicies = serviceAccountAccessPoliciesResponse.groupAccessPolicies.map(
      (ap) => {
        return this.createGroupServiceAccountAccessPolicyView(ap);
      }
    );
    return view;
  }

  private createUserServiceAccountAccessPolicyView(
    response: UserServiceAccountAccessPolicyResponse
  ): UserServiceAccountAccessPolicyView {
    return {
      ...this.createBaseAccessPolicyView(response),
      grantedServiceAccountId: response.grantedServiceAccountId,
      organizationUserId: response.organizationUserId,
      organizationUserName: response.organizationUserName,
      userId: response.userId,
    };
  }

  private createGroupServiceAccountAccessPolicyView(
    response: GroupServiceAccountAccessPolicyResponse
  ): GroupServiceAccountAccessPolicyView {
    return {
      ...this.createBaseAccessPolicyView(response),
      grantedServiceAccountId: response.grantedServiceAccountId,
      groupId: response.groupId,
      groupName: response.groupName,
      currentUserInGroup: response.currentUserInGroup,
    };
  }

  async getPeoplePotentialGrantees(organizationId: Guid) {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/access-policies/people/potential-grantees",
      null,
      true,
      true
    );
    const results = new ListResponse(r, PotentialGranteeResponse);
    return await this.createPotentialGranteeViews(organizationId, results.data);
  }

  async getServiceAccountsPotentialGrantees(organizationId: Guid) {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/access-policies/service-accounts/potential-grantees",
      null,
      true,
      true
    );
    const results = new ListResponse(r, PotentialGranteeResponse);
    return await this.createPotentialGranteeViews(organizationId, results.data);
  }

  async getProjectsPotentialGrantees(organizationId: Guid) {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/access-policies/projects/potential-grantees",
      null,
      true,
      true
    );
    const results = new ListResponse(r, PotentialGranteeResponse);
    return await this.createPotentialGranteeViews(organizationId, results.data);
  }

  protected async getOrganizationKey(organizationId: Guid): Promise<SymmetricCryptoKey> {
    return await this.cryptoService.getOrgKey(organizationId);
  }

  protected getAccessPolicyRequest(
    granteeId: Guid,
    view:
      | UserProjectAccessPolicyView
      | UserServiceAccountAccessPolicyView
      | GroupProjectAccessPolicyView
      | GroupServiceAccountAccessPolicyView
      | ServiceAccountProjectAccessPolicyView
  ) {
    const request = new AccessPolicyRequest();
    request.granteeId = granteeId;
    request.read = view.read;
    request.write = view.write;
    return request;
  }

  protected createBaseAccessPolicyView(
    response:
      | UserProjectAccessPolicyResponse
      | UserServiceAccountAccessPolicyResponse
      | GroupProjectAccessPolicyResponse
      | GroupServiceAccountAccessPolicyResponse
      | ServiceAccountProjectAccessPolicyResponse
  ) {
    return {
      id: response.id,
      read: response.read,
      write: response.write,
      creationDate: response.creationDate,
      revisionDate: response.revisionDate,
    };
  }

  private async createPotentialGranteeViews(
    organizationId: Guid,
    results: PotentialGranteeResponse[]
  ): Promise<PotentialGranteeView[]> {
    const orgKey = await this.getOrganizationKey(organizationId);
    return await Promise.all(
      results.map(async (r) => {
        const view = new PotentialGranteeView();
        view.id = r.id;
        view.type = r.type;
        view.email = r.email;

        if (r.type === "serviceAccount" || r.type === "project") {
          view.name = await this.encryptService.decryptToUtf8(new EncString(r.name), orgKey);
        } else {
          view.name = r.name;
        }
        return view;
      })
    );
  }

  private getGrantedPoliciesCreateRequest(
    policies: ServiceAccountProjectAccessPolicyView[]
  ): GrantedPolicyRequest[] {
    return policies.map((ap) => {
      const request = new GrantedPolicyRequest();
      request.grantedId = ap.grantedProjectId;
      request.read = ap.read;
      request.write = ap.write;
      return request;
    });
  }

  private async createServiceAccountProjectAccessPolicyViews(
    responses: ServiceAccountProjectAccessPolicyResponse[],
    organizationId: Guid
  ): Promise<ServiceAccountProjectAccessPolicyView[]> {
    const orgKey = await this.getOrganizationKey(organizationId);
    return await Promise.all(
      responses.map(async (response: ServiceAccountProjectAccessPolicyResponse) => {
        const view = new ServiceAccountProjectAccessPolicyView();
        view.id = response.id;
        view.read = response.read;
        view.write = response.write;
        view.creationDate = response.creationDate;
        view.revisionDate = response.revisionDate;
        view.serviceAccountId = response.serviceAccountId;
        view.grantedProjectId = response.grantedProjectId;
        view.serviceAccountName = response.serviceAccountName
          ? await this.encryptService.decryptToUtf8(
              new EncString(response.serviceAccountName),
              orgKey
            )
          : null;
        view.grantedProjectName = response.grantedProjectName
          ? await this.encryptService.decryptToUtf8(
              new EncString(response.grantedProjectName),
              orgKey
            )
          : null;
        return view;
      })
    );
  }
}
