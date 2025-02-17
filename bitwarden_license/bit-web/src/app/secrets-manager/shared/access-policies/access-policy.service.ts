// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { KeyService } from "@bitwarden/key-management";

import {
  UserAccessPolicyView,
  GroupAccessPolicyView,
  ServiceAccountAccessPolicyView,
  GrantedProjectAccessPolicyView,
} from "../../models/view/access-policies/access-policy.view";
import { PotentialGranteeView } from "../../models/view/access-policies/potential-grantee.view";
import { ProjectPeopleAccessPoliciesView } from "../../models/view/access-policies/project-people-access-policies.view";
import { ProjectServiceAccountsAccessPoliciesView } from "../../models/view/access-policies/project-service-accounts-access-policies.view";
import { SecretAccessPoliciesView } from "../../models/view/access-policies/secret-access-policies.view";
import {
  ServiceAccountGrantedPoliciesView,
  GrantedProjectPolicyPermissionDetailsView,
} from "../../models/view/access-policies/service-account-granted-policies.view";
import { ServiceAccountPeopleAccessPoliciesView } from "../../models/view/access-policies/service-account-people-access-policies.view";
import { PeopleAccessPoliciesRequest } from "../../shared/access-policies/models/requests/people-access-policies.request";
import { ServiceAccountGrantedPoliciesRequest } from "../access-policies/models/requests/service-account-granted-policies.request";

import { AccessPolicyRequest } from "./models/requests/access-policy.request";
import { ProjectServiceAccountsAccessPoliciesRequest } from "./models/requests/project-service-accounts-access-policies.request";
import { SecretAccessPoliciesRequest } from "./models/requests/secret-access-policies.request";
import {
  GroupAccessPolicyResponse,
  UserAccessPolicyResponse,
  ServiceAccountAccessPolicyResponse,
  GrantedProjectAccessPolicyResponse,
} from "./models/responses/access-policy.response";
import { PotentialGranteeResponse } from "./models/responses/potential-grantee.response";
import { ProjectPeopleAccessPoliciesResponse } from "./models/responses/project-people-access-policies.response";
import { ProjectServiceAccountsAccessPoliciesResponse } from "./models/responses/project-service-accounts-access-policies.response";
import { SecretAccessPoliciesResponse } from "./models/responses/secret-access-policies.response";
import { ServiceAccountGrantedPoliciesPermissionDetailsResponse } from "./models/responses/service-account-granted-policies-permission-details.response";
import { ServiceAccountPeopleAccessPoliciesResponse } from "./models/responses/service-account-people-access-policies.response";
import { GrantedProjectAccessPolicyPermissionDetailsResponse } from "./models/responses/service-account-project-policy-permission-details.response";

@Injectable({
  providedIn: "root",
})
export class AccessPolicyService {
  protected _accessPolicy: Subject<
    | ProjectPeopleAccessPoliciesView
    | ProjectServiceAccountsAccessPoliciesView
    | ServiceAccountPeopleAccessPoliciesView
    | ServiceAccountGrantedPoliciesView
  > = new Subject();

  accessPolicy$ = this._accessPolicy.asObservable();

  constructor(
    private keyService: KeyService,
    protected apiService: ApiService,
    protected encryptService: EncryptService,
  ) {}

  async getProjectPeopleAccessPolicies(
    projectId: string,
  ): Promise<ProjectPeopleAccessPoliciesView> {
    const r = await this.apiService.send(
      "GET",
      "/projects/" + projectId + "/access-policies/people",
      null,
      true,
      true,
    );

    const results = new ProjectPeopleAccessPoliciesResponse(r);
    return this.createPeopleAccessPoliciesView(results);
  }

  async putProjectPeopleAccessPolicies(
    projectId: string,
    peoplePoliciesView: ProjectPeopleAccessPoliciesView,
  ): Promise<ProjectPeopleAccessPoliciesView> {
    const request = this.getPeopleAccessPoliciesRequest(peoplePoliciesView);
    const r = await this.apiService.send(
      "PUT",
      "/projects/" + projectId + "/access-policies/people",
      request,
      true,
      true,
    );
    const results = new ProjectPeopleAccessPoliciesResponse(r);
    const view = this.createPeopleAccessPoliciesView(results);
    this._accessPolicy.next(view);
    return view;
  }

  async getServiceAccountPeopleAccessPolicies(
    serviceAccountId: string,
  ): Promise<ServiceAccountPeopleAccessPoliciesView> {
    const r = await this.apiService.send(
      "GET",
      "/service-accounts/" + serviceAccountId + "/access-policies/people",
      null,
      true,
      true,
    );

    const results = new ServiceAccountPeopleAccessPoliciesResponse(r);
    return this.createPeopleAccessPoliciesView(results);
  }

  async putServiceAccountPeopleAccessPolicies(
    serviceAccountId: string,
    peoplePoliciesView: ServiceAccountPeopleAccessPoliciesView,
  ): Promise<ServiceAccountPeopleAccessPoliciesView> {
    const request = this.getPeopleAccessPoliciesRequest(peoplePoliciesView);
    const r = await this.apiService.send(
      "PUT",
      "/service-accounts/" + serviceAccountId + "/access-policies/people",
      request,
      true,
      true,
    );
    const results = new ServiceAccountPeopleAccessPoliciesResponse(r);
    const view = this.createPeopleAccessPoliciesView(results);
    this._accessPolicy.next(view);
    return view;
  }

  async getServiceAccountGrantedPolicies(
    organizationId: string,
    serviceAccountId: string,
  ): Promise<ServiceAccountGrantedPoliciesView> {
    const r = await this.apiService.send(
      "GET",
      "/service-accounts/" + serviceAccountId + "/granted-policies",
      null,
      true,
      true,
    );

    const result = new ServiceAccountGrantedPoliciesPermissionDetailsResponse(r);
    return await this.createServiceAccountGrantedPoliciesView(result, organizationId);
  }

  async putServiceAccountGrantedPolicies(
    organizationId: string,
    serviceAccountId: string,
    policies: ServiceAccountGrantedPoliciesView,
  ): Promise<ServiceAccountGrantedPoliciesView> {
    const request = this.getServiceAccountGrantedPoliciesRequest(policies);
    const r = await this.apiService.send(
      "PUT",
      "/service-accounts/" + serviceAccountId + "/granted-policies",
      request,
      true,
      true,
    );

    const result = new ServiceAccountGrantedPoliciesPermissionDetailsResponse(r);
    const view = await this.createServiceAccountGrantedPoliciesView(result, organizationId);
    this._accessPolicy.next(view);
    return view;
  }

  async getProjectServiceAccountsAccessPolicies(
    organizationId: string,
    projectId: string,
  ): Promise<ProjectServiceAccountsAccessPoliciesView> {
    const r = await this.apiService.send(
      "GET",
      "/projects/" + projectId + "/access-policies/service-accounts",
      null,
      true,
      true,
    );

    const result = new ProjectServiceAccountsAccessPoliciesResponse(r);
    return await this.createProjectServiceAccountsAccessPoliciesView(result, organizationId);
  }

  async putProjectServiceAccountsAccessPolicies(
    organizationId: string,
    projectId: string,
    policies: ProjectServiceAccountsAccessPoliciesView,
  ): Promise<ProjectServiceAccountsAccessPoliciesView> {
    const request = this.getProjectServiceAccountsAccessPoliciesRequest(policies);
    const r = await this.apiService.send(
      "PUT",
      "/projects/" + projectId + "/access-policies/service-accounts",
      request,
      true,
      true,
    );

    const result = new ProjectServiceAccountsAccessPoliciesResponse(r);
    const view = await this.createProjectServiceAccountsAccessPoliciesView(result, organizationId);
    this._accessPolicy.next(view);
    return view;
  }

  async getSecretAccessPolicies(
    organizationId: string,
    secretId: string,
  ): Promise<SecretAccessPoliciesView> {
    const r = await this.apiService.send(
      "GET",
      "/secrets/" + secretId + "/access-policies",
      null,
      true,
      true,
    );

    const result = new SecretAccessPoliciesResponse(r);
    return await this.createSecretAccessPoliciesView(result, organizationId);
  }

  async getPeoplePotentialGrantees(organizationId: string) {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/access-policies/people/potential-grantees",
      null,
      true,
      true,
    );
    const results = new ListResponse(r, PotentialGranteeResponse);
    return await this.createPotentialGranteeViews(organizationId, results.data);
  }

  async getServiceAccountsPotentialGrantees(organizationId: string) {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/access-policies/service-accounts/potential-grantees",
      null,
      true,
      true,
    );
    const results = new ListResponse(r, PotentialGranteeResponse);
    return await this.createPotentialGranteeViews(organizationId, results.data);
  }

  async getProjectsPotentialGrantees(organizationId: string) {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/access-policies/projects/potential-grantees",
      null,
      true,
      true,
    );
    const results = new ListResponse(r, PotentialGranteeResponse);
    return await this.createPotentialGranteeViews(organizationId, results.data);
  }

  getSecretAccessPoliciesRequest(view: SecretAccessPoliciesView): SecretAccessPoliciesRequest {
    return {
      userAccessPolicyRequests: view.userAccessPolicies.map((ap) => {
        return this.getAccessPolicyRequest(ap.organizationUserId, ap);
      }),
      groupAccessPolicyRequests: view.groupAccessPolicies.map((ap) => {
        return this.getAccessPolicyRequest(ap.groupId, ap);
      }),
      serviceAccountAccessPolicyRequests: view.serviceAccountAccessPolicies.map((ap) => {
        return this.getAccessPolicyRequest(ap.serviceAccountId, ap);
      }),
    };
  }

  private async getOrganizationKey(organizationId: string): Promise<SymmetricCryptoKey> {
    return await this.keyService.getOrgKey(organizationId);
  }

  private getAccessPolicyRequest(
    granteeId: string,
    view: UserAccessPolicyView | GroupAccessPolicyView | ServiceAccountAccessPolicyView,
  ) {
    const request = new AccessPolicyRequest();
    request.granteeId = granteeId;
    request.read = view.read;
    request.write = view.write;
    return request;
  }

  private getServiceAccountGrantedPoliciesRequest(
    policies: ServiceAccountGrantedPoliciesView,
  ): ServiceAccountGrantedPoliciesRequest {
    const request = new ServiceAccountGrantedPoliciesRequest();

    request.projectGrantedPolicyRequests = policies.grantedProjectPolicies.map((detailView) => ({
      grantedId: detailView.accessPolicy.grantedProjectId,
      read: detailView.accessPolicy.read,
      write: detailView.accessPolicy.write,
    }));

    return request;
  }

  private getProjectServiceAccountsAccessPoliciesRequest(
    policies: ProjectServiceAccountsAccessPoliciesView,
  ): ProjectServiceAccountsAccessPoliciesRequest {
    const request = new ProjectServiceAccountsAccessPoliciesRequest();

    request.serviceAccountAccessPolicyRequests = policies.serviceAccountAccessPolicies.map((ap) => {
      return this.getAccessPolicyRequest(ap.serviceAccountId, ap);
    });

    return request;
  }

  private getPeopleAccessPoliciesRequest(
    view: ProjectPeopleAccessPoliciesView | ServiceAccountPeopleAccessPoliciesView,
  ): PeopleAccessPoliciesRequest {
    const request = new PeopleAccessPoliciesRequest();

    if (view.userAccessPolicies?.length > 0) {
      request.userAccessPolicyRequests = view.userAccessPolicies.map((ap) => {
        return this.getAccessPolicyRequest(ap.organizationUserId, ap);
      });
    }

    if (view.groupAccessPolicies?.length > 0) {
      request.groupAccessPolicyRequests = view.groupAccessPolicies.map((ap) => {
        return this.getAccessPolicyRequest(ap.groupId, ap);
      });
    }

    return request;
  }

  private createBaseAccessPolicyView(
    response:
      | UserAccessPolicyResponse
      | GroupAccessPolicyResponse
      | ServiceAccountAccessPolicyResponse
      | GrantedProjectAccessPolicyResponse,
  ) {
    return {
      read: response.read,
      write: response.write,
    };
  }

  private async createGrantedProjectAccessPolicyView(
    organizationKey: SymmetricCryptoKey,
    response: GrantedProjectAccessPolicyResponse,
  ): Promise<GrantedProjectAccessPolicyView> {
    return {
      ...this.createBaseAccessPolicyView(response),
      grantedProjectId: response.grantedProjectId,
      grantedProjectName: response.grantedProjectName
        ? await this.encryptService.decryptToUtf8(
            new EncString(response.grantedProjectName),
            organizationKey,
          )
        : null,
    };
  }

  private createUserAccessPolicyViews(
    responses: UserAccessPolicyResponse[],
  ): UserAccessPolicyView[] {
    return responses.map((response) => {
      return {
        ...this.createBaseAccessPolicyView(response),
        organizationUserId: response.organizationUserId,
        organizationUserName: response.organizationUserName,
        currentUser: response.currentUser,
      };
    });
  }

  private createGroupAccessPolicyViews(
    responses: GroupAccessPolicyResponse[],
  ): GroupAccessPolicyView[] {
    return responses.map((response) => {
      return {
        ...this.createBaseAccessPolicyView(response),
        groupId: response.groupId,
        groupName: response.groupName,
        currentUserInGroup: response.currentUserInGroup,
      };
    });
  }

  private async createServiceAccountAccessPolicyViews(
    orgKey: SymmetricCryptoKey,
    responses: ServiceAccountAccessPolicyResponse[],
  ): Promise<ServiceAccountAccessPolicyView[]> {
    return await Promise.all(
      responses.map(async (response) => {
        return {
          ...this.createBaseAccessPolicyView(response),
          serviceAccountId: response.serviceAccountId,
          serviceAccountName: response.serviceAccountName
            ? await this.encryptService.decryptToUtf8(
                new EncString(response.serviceAccountName),
                orgKey,
              )
            : null,
        };
      }),
    );
  }

  private async createPotentialGranteeViews(
    organizationId: string,
    results: PotentialGranteeResponse[],
  ): Promise<PotentialGranteeView[]> {
    const orgKey = await this.getOrganizationKey(organizationId);
    return await Promise.all(
      results.map(async (r) => {
        const view = new PotentialGranteeView();
        view.id = r.id;
        view.type = r.type;
        view.email = r.email;
        view.currentUser = r.currentUser;
        view.currentUserInGroup = r.currentUserInGroup;

        if (r.type === "serviceAccount" || r.type === "project") {
          view.name = r.name
            ? await this.encryptService.decryptToUtf8(new EncString(r.name), orgKey)
            : null;
        } else {
          view.name = r.name;
        }
        return view;
      }),
    );
  }

  private async createServiceAccountGrantedPoliciesView(
    response: ServiceAccountGrantedPoliciesPermissionDetailsResponse,
    organizationId: string,
  ): Promise<ServiceAccountGrantedPoliciesView> {
    const orgKey = await this.getOrganizationKey(organizationId);

    return {
      grantedProjectPolicies: await this.createGrantedProjectPolicyPermissionDetailsViews(
        orgKey,
        response.grantedProjectPolicies,
      ),
    };
  }

  private async createGrantedProjectPolicyPermissionDetailsViews(
    orgKey: SymmetricCryptoKey,
    responses: GrantedProjectAccessPolicyPermissionDetailsResponse[],
  ): Promise<GrantedProjectPolicyPermissionDetailsView[]> {
    return await Promise.all(
      responses.map(async (response) => {
        return await this.createGrantedProjectPolicyPermissionDetailsView(orgKey, response);
      }),
    );
  }

  private async createGrantedProjectPolicyPermissionDetailsView(
    orgKey: SymmetricCryptoKey,
    response: GrantedProjectAccessPolicyPermissionDetailsResponse,
  ): Promise<GrantedProjectPolicyPermissionDetailsView> {
    const view = new GrantedProjectPolicyPermissionDetailsView();
    view.hasPermission = response.hasPermission;
    view.accessPolicy = await this.createGrantedProjectAccessPolicyView(
      orgKey,
      response.accessPolicy,
    );
    return view;
  }

  private createPeopleAccessPoliciesView(
    response: ProjectPeopleAccessPoliciesResponse | ServiceAccountPeopleAccessPoliciesResponse,
  ): ProjectPeopleAccessPoliciesView | ServiceAccountPeopleAccessPoliciesView {
    return {
      userAccessPolicies: this.createUserAccessPolicyViews(response.userAccessPolicies),
      groupAccessPolicies: this.createGroupAccessPolicyViews(response.groupAccessPolicies),
    };
  }

  private async createProjectServiceAccountsAccessPoliciesView(
    response: ProjectServiceAccountsAccessPoliciesResponse,
    organizationId: string,
  ): Promise<ProjectServiceAccountsAccessPoliciesView> {
    const orgKey = await this.getOrganizationKey(organizationId);
    return {
      serviceAccountAccessPolicies: await this.createServiceAccountAccessPolicyViews(
        orgKey,
        response.serviceAccountAccessPolicies,
      ),
    };
  }

  private async createSecretAccessPoliciesView(
    response: SecretAccessPoliciesResponse,
    organizationId: string,
  ): Promise<SecretAccessPoliciesView> {
    const orgKey = await this.getOrganizationKey(organizationId);
    return {
      userAccessPolicies: this.createUserAccessPolicyViews(response.userAccessPolicies),
      groupAccessPolicies: this.createGroupAccessPolicyViews(response.groupAccessPolicies),
      serviceAccountAccessPolicies: await this.createServiceAccountAccessPolicyViews(
        orgKey,
        response.serviceAccountAccessPolicies,
      ),
    };
  }
}
