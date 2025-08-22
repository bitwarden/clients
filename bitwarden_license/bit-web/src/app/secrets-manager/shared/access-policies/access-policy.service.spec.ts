// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountInfo, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import {
  GroupAccessPolicyView,
  ServiceAccountAccessPolicyView,
  UserAccessPolicyView,
} from "../../models/view/access-policies/access-policy.view";
import { ProjectPeopleAccessPoliciesView } from "../../models/view/access-policies/project-people-access-policies.view";
import { ProjectServiceAccountsAccessPoliciesView } from "../../models/view/access-policies/project-service-accounts-access-policies.view";
import {
  GrantedProjectPolicyPermissionDetailsView,
  ServiceAccountGrantedPoliciesView,
} from "../../models/view/access-policies/service-account-granted-policies.view";
import { ServiceAccountPeopleAccessPoliciesView } from "../../models/view/access-policies/service-account-people-access-policies.view";

import { AccessPolicyService } from "./access-policy.service";
import { PeopleAccessPoliciesRequest } from "./models/requests/people-access-policies.request";
import { ProjectServiceAccountsAccessPoliciesRequest } from "./models/requests/project-service-accounts-access-policies.request";
import { ServiceAccountGrantedPoliciesRequest } from "./models/requests/service-account-granted-policies.request";

import { trackEmissions } from "@bitwarden/common/../spec";

const SomeCsprngArray = new Uint8Array(64) as CsprngArray;
const SomeOrganization = "some organization" as OrganizationId;
const AnotherOrganization = "another organization" as OrganizationId;
const SomeOrgKey = new SymmetricCryptoKey(SomeCsprngArray) as OrgKey;
const AnotherOrgKey = new SymmetricCryptoKey(SomeCsprngArray) as OrgKey;
const OrgRecords: Record<OrganizationId, OrgKey> = {
  [SomeOrganization]: SomeOrgKey,
  [AnotherOrganization]: AnotherOrgKey,
};

describe("AccessPolicyService", () => {
  let sut: AccessPolicyService;

  const keyService = mock<KeyService>();
  const apiService = mock<ApiService>();
  const encryptService = mock<EncryptService>();
  let accountService: MockProxy<AccountService>;
  const activeAccountSubject = new BehaviorSubject<{ id: UserId } & AccountInfo>({
    id: "testId" as UserId,
    email: "test@example.com",
    emailVerified: true,
    name: "Test User",
  });

  beforeEach(() => {
    jest.resetAllMocks();

    const orgKey$ = new BehaviorSubject(OrgRecords);
    keyService.orgKeys$.mockReturnValue(orgKey$);

    accountService = mock<AccountService>();
    accountService.activeAccount$ = activeAccountSubject;
    sut = new AccessPolicyService(keyService, apiService, encryptService, accountService);
  });

  it("instantiates", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("putProjectPeopleAccessPolicies", () => {
    it("emits the updated policies", async () => {
      const userAccessPolicyView1 = createUserAccessPolicyView(false, true);
      const userAccessPolicyView2 = createUserAccessPolicyView(true, false);
      const groupAccessPolicyView1 = createGroupAccessPolicyView(false, true);
      const groupAccessPolicyView2 = createGroupAccessPolicyView(true, false);

      const view = {
        userAccessPolicies: [userAccessPolicyView1, userAccessPolicyView2],
        groupAccessPolicies: [groupAccessPolicyView1, groupAccessPolicyView2],
      } as ProjectPeopleAccessPoliciesView;

      apiService.send.mockResolvedValue(toProjectPeopleAccessPoliciesResponseRaw(view));
      const emissions = trackEmissions(sut.accessPolicy$);
      const expectedRequest = toPeopleAccessPoliciesRequest(view);
      const projectId = Utils.newGuid();

      const result = await sut.putProjectPeopleAccessPolicies(projectId, view);

      expect(result).toEqual(view);
      expect(apiService.send).toHaveBeenCalledWith(
        "PUT",
        "/projects/" + projectId + "/access-policies/people",
        expectedRequest,
        true,
        true,
      );
      expect(emissions).toEqual([view]);
    });
  });

  describe("putServiceAccountPeopleAccessPolicies", () => {
    it("emits the updated policies", async () => {
      const userAccessPolicyView1 = createUserAccessPolicyView(false, true);
      const userAccessPolicyView2 = createUserAccessPolicyView(true, false);
      const groupAccessPolicyView1 = createGroupAccessPolicyView(false, true);
      const groupAccessPolicyView2 = createGroupAccessPolicyView(true, false);

      const view = {
        userAccessPolicies: [userAccessPolicyView1, userAccessPolicyView2],
        groupAccessPolicies: [groupAccessPolicyView1, groupAccessPolicyView2],
      } as ServiceAccountPeopleAccessPoliciesView;

      apiService.send.mockResolvedValue(toServiceAccountPeopleAccessPoliciesResponseRaw(view));
      const emissions = trackEmissions(sut.accessPolicy$);
      const expectedRequest = toPeopleAccessPoliciesRequest(view);
      const projectId = Utils.newGuid();

      const result = await sut.putServiceAccountPeopleAccessPolicies(projectId, view);

      expect(result).toEqual(view);
      expect(apiService.send).toHaveBeenCalledWith(
        "PUT",
        "/service-accounts/" + projectId + "/access-policies/people",
        expectedRequest,
        true,
        true,
      );
      expect(emissions).toEqual([view]);
    });
  });

  describe("putServiceAccountGrantedPolicies", () => {
    it("emits the updated policies", async () => {
      const policyPermissionDetailsView1 = createGrantedProjectPolicyPermissionDetailsView(
        false,
        false,
      );
      const policyPermissionDetailsView2 = createGrantedProjectPolicyPermissionDetailsView(
        false,
        true,
      );
      const policyPermissionDetailsView3 = createGrantedProjectPolicyPermissionDetailsView(
        true,
        true,
      );

      const view = {
        grantedProjectPolicies: [
          policyPermissionDetailsView1,
          policyPermissionDetailsView2,
          policyPermissionDetailsView3,
        ],
      } as ServiceAccountGrantedPoliciesView;

      apiService.send.mockResolvedValue(toServiceAccountGrantedPoliciesResponseRaw(view));
      const emissions = trackEmissions(sut.accessPolicy$);
      const expectedRequest = toServiceAccountGrantedPoliciesRequest(view);
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      const mockOrgKey = new SymmetricCryptoKey(mockRandomBytes) as OrgKey;
      keyService.getOrgKey.mockResolvedValue(mockOrgKey);
      encryptService.decryptString.mockImplementation((c) => Promise.resolve(c.encryptedString));
      const organizationId = Utils.newGuid();
      const serviceAccountId = Utils.newGuid();

      const result = await sut.putServiceAccountGrantedPolicies(
        organizationId,
        serviceAccountId,
        view,
      );

      expect(result).toEqual(view);
      expect(apiService.send).toHaveBeenCalledWith(
        "PUT",
        "/service-accounts/" + serviceAccountId + "/granted-policies",
        expectedRequest,
        true,
        true,
      );
      expect(emissions).toEqual([view]);
    });
  });

  describe("putProjectServiceAccountsAccessPolicies", () => {
    it("emits the updated policies", async () => {
      const accessPolicyView1 = createServiceAccountAccessPolicyView(false);
      const accessPolicyView2 = createServiceAccountAccessPolicyView(true);

      const view = {
        serviceAccountAccessPolicies: [accessPolicyView1, accessPolicyView2],
      } as ProjectServiceAccountsAccessPoliciesView;

      apiService.send.mockResolvedValue(toProjectServiceAccountsAccessPoliciesResponseRaw(view));
      const emissions = trackEmissions(sut.accessPolicy$);
      const expectedRequest = toProjectServiceAccountsAccessPoliciesRequest(view);
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      const mockOrgKey = new SymmetricCryptoKey(mockRandomBytes) as OrgKey;
      keyService.getOrgKey.mockResolvedValue(mockOrgKey);
      encryptService.decryptString.mockImplementation((c) => Promise.resolve(c.encryptedString));
      const organizationId = Utils.newGuid();
      const projectId = Utils.newGuid();

      const result = await sut.putProjectServiceAccountsAccessPolicies(
        organizationId,
        projectId,
        view,
      );

      expect(result).toEqual(view);
      expect(apiService.send).toHaveBeenCalledWith(
        "PUT",
        "/projects/" + projectId + "/access-policies/service-accounts",
        expectedRequest,
        true,
        true,
      );
      expect(emissions).toEqual([view]);
    });
  });
});

function createUserAccessPolicyView(isWrite: boolean, currentUser: boolean): UserAccessPolicyView {
  const id = Utils.newGuid();
  return {
    organizationUserId: id,
    organizationUserName: "Example organization user name " + id,
    read: true,
    write: isWrite,
    currentUser: currentUser,
  };
}

function createGroupAccessPolicyView(
  isWrite: boolean,
  currentUserInGroup: boolean,
): GroupAccessPolicyView {
  const id = Utils.newGuid();
  return {
    groupId: id,
    groupName: "Example group name " + id,
    currentUserInGroup: currentUserInGroup,
    read: true,
    write: isWrite,
  };
}

function createServiceAccountAccessPolicyView(isWrite: boolean): ServiceAccountAccessPolicyView {
  const id = Utils.newGuid();
  return {
    serviceAccountId: id,
    serviceAccountName: "Example service account name " + id,
    read: true,
    write: isWrite,
  };
}

function createGrantedProjectPolicyPermissionDetailsView(
  isWrite: boolean,
  hasPermissions: boolean,
): GrantedProjectPolicyPermissionDetailsView {
  const id = Utils.newGuid();
  return {
    accessPolicy: {
      grantedProjectId: id,
      grantedProjectName: "Example project name " + id,
      read: true,
      write: isWrite,
    },
    hasPermission: hasPermissions,
  };
}

function toPeopleAccessPoliciesRequest(
  view: ProjectPeopleAccessPoliciesView | ServiceAccountPeopleAccessPoliciesView,
): PeopleAccessPoliciesRequest {
  return {
    userAccessPolicyRequests: view.userAccessPolicies.map((ap) => ({
      granteeId: ap.organizationUserId,
      read: ap.read,
      write: ap.write,
    })),
    groupAccessPolicyRequests: view.groupAccessPolicies.map((ap) => ({
      granteeId: ap.groupId,
      read: ap.read,
      write: ap.write,
    })),
  };
}

function toServiceAccountGrantedPoliciesRequest(
  view: ServiceAccountGrantedPoliciesView,
): ServiceAccountGrantedPoliciesRequest {
  return {
    projectGrantedPolicyRequests: view.grantedProjectPolicies.map((ap) => ({
      grantedId: ap.accessPolicy.grantedProjectId,
      read: ap.accessPolicy.read,
      write: ap.accessPolicy.write,
    })),
  };
}

function toProjectServiceAccountsAccessPoliciesRequest(
  view: ProjectServiceAccountsAccessPoliciesView,
): ProjectServiceAccountsAccessPoliciesRequest {
  return {
    serviceAccountAccessPolicyRequests: view.serviceAccountAccessPolicies.map((ap) => {
      return {
        granteeId: ap.serviceAccountId,
        read: ap.read,
        write: ap.write,
      };
    }),
  };
}

function toProjectPeopleAccessPoliciesResponseRaw(view: ProjectPeopleAccessPoliciesView) {
  return {
    userAccessPolicies: view.userAccessPolicies.map((ap) => ({
      organizationUserId: ap.organizationUserId,
      organizationUserName: ap.organizationUserName,
      currentUser: ap.currentUser,
      read: ap.read,
      write: ap.write,
    })),
    groupAccessPolicies: view.groupAccessPolicies.map((ap) => ({
      groupId: ap.groupId,
      groupName: ap.groupName,
      currentUserInGroup: ap.currentUserInGroup,
      read: ap.read,
      write: ap.write,
    })),
  };
}

function toServiceAccountPeopleAccessPoliciesResponseRaw(
  view: ServiceAccountPeopleAccessPoliciesView,
) {
  return {
    userAccessPolicies: view.userAccessPolicies.map((ap) => ({
      organizationUserId: ap.organizationUserId,
      organizationUserName: ap.organizationUserName,
      currentUser: ap.currentUser,
      read: ap.read,
      write: ap.write,
    })),
    groupAccessPolicies: view.groupAccessPolicies.map((ap) => ({
      groupId: ap.groupId,
      groupName: ap.groupName,
      currentUserInGroup: ap.currentUserInGroup,
      read: ap.read,
      write: ap.write,
    })),
  };
}

function toServiceAccountGrantedPoliciesResponseRaw(view: ServiceAccountGrantedPoliciesView) {
  return {
    grantedProjectPolicies: view.grantedProjectPolicies.map((ap) => ({
      accessPolicy: {
        grantedProjectId: ap.accessPolicy.grantedProjectId,
        grantedProjectName: ap.accessPolicy.grantedProjectName,
        read: ap.accessPolicy.read,
        write: ap.accessPolicy.write,
      },
      hasPermission: ap.hasPermission,
    })),
  };
}

function toProjectServiceAccountsAccessPoliciesResponseRaw(
  view: ProjectServiceAccountsAccessPoliciesView,
) {
  return {
    serviceAccountAccessPolicies: view.serviceAccountAccessPolicies.map((ap) => ({
      serviceAccountId: ap.serviceAccountId,
      serviceAccountName: ap.serviceAccountName,
      currentUser: true,
      read: ap.read,
      write: ap.write,
    })),
  };
}
