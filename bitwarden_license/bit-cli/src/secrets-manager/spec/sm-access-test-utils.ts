import { mock } from "jest-mock-extended";

import {
  AccessPolicyService,
  PotentialGranteeView,
  ProjectService,
  ProjectView,
  SecretService,
  SecretView,
  ServiceAccountService,
  ServiceAccountView,
} from "@bitwarden/bit-sm";

import { SmAccessPolicyStore } from "../access/sm-access-policies";

import { smOrgId } from "./sm-test-utils";

export const smTargetId = "22222222-2222-2222-2222-222222222222";
export const aliceId = "a1a1a1a1-0000-0000-0000-000000000001";
export const bobId = "b0b0b0b0-0000-0000-0000-000000000002";
export const groupId = "9a9a9a9a-0000-0000-0000-000000000003";
export const machineAccountId = "3c3c3c3c-0000-0000-0000-000000000004";
export const projectId = "4d4d4d4d-0000-0000-0000-000000000005";

export function potentialGrantee(
  type: string,
  id: string,
  name: string,
  email?: string,
): PotentialGranteeView {
  return Object.assign(new PotentialGranteeView(), { type, id, name, email });
}

/**
 * Builds a real `SmAccessPolicyStore` over mocked services. The target project, machine
 * account, and secret all belong to `smOrgId` and have no policies until a test stubs them.
 */
export function createSmAccessFixture() {
  const accessPolicyService = mock<AccessPolicyService>();
  const projectService = mock<ProjectService>();
  const serviceAccountService = mock<ServiceAccountService>();
  const secretService = mock<SecretService>();

  projectService.getByProjectId.mockResolvedValue(
    Object.assign(new ProjectView(), { id: smTargetId, organizationId: smOrgId, write: true }),
  );
  serviceAccountService.getByServiceAccountId.mockResolvedValue(
    Object.assign(new ServiceAccountView(), { id: smTargetId, organizationId: smOrgId }),
  );
  secretService.getBySecretId.mockResolvedValue(
    Object.assign(new SecretView(), {
      id: smTargetId,
      organizationId: smOrgId,
      name: "API_KEY",
      value: "value",
      note: "",
      projects: [],
      read: true,
      write: true,
    }),
  );

  accessPolicyService.getProjectPeopleAccessPolicies.mockResolvedValue({
    userAccessPolicies: [],
    groupAccessPolicies: [],
  });
  accessPolicyService.getProjectServiceAccountsAccessPolicies.mockResolvedValue({
    serviceAccountAccessPolicies: [],
  });
  accessPolicyService.getServiceAccountPeopleAccessPolicies.mockResolvedValue({
    userAccessPolicies: [],
    groupAccessPolicies: [],
  });
  accessPolicyService.getServiceAccountGrantedPolicies.mockResolvedValue({
    grantedProjectPolicies: [],
  });
  accessPolicyService.getSecretAccessPolicies.mockResolvedValue({
    userAccessPolicies: [],
    groupAccessPolicies: [],
    serviceAccountAccessPolicies: [],
  });
  accessPolicyService.getPeoplePotentialGrantees.mockResolvedValue([
    potentialGrantee("user", aliceId, "Alice", "alice@example.com"),
    potentialGrantee("user", bobId, "Bob", "bob@example.com"),
    potentialGrantee("group", groupId, "Engineering"),
  ]);
  accessPolicyService.getServiceAccountsPotentialGrantees.mockResolvedValue([
    potentialGrantee("serviceAccount", machineAccountId, "CI runner"),
  ]);
  accessPolicyService.getProjectsPotentialGrantees.mockResolvedValue([
    potentialGrantee("project", projectId, "Backend"),
  ]);

  const store = new SmAccessPolicyStore(
    accessPolicyService,
    projectService,
    serviceAccountService,
    secretService,
  );

  return {
    store,
    accessPolicyService,
    projectService,
    serviceAccountService,
    secretService,
  };
}

export function userPolicy(id: string, name: string, write = false) {
  return {
    organizationUserId: id,
    organizationUserName: name,
    currentUser: false,
    read: true,
    write,
  };
}

export function groupPolicy(id: string, name: string, write = false) {
  return { groupId: id, groupName: name, currentUserInGroup: false, read: true, write };
}

export function machineAccountPolicy(id: string, name: string, write = false) {
  return { serviceAccountId: id, serviceAccountName: name, read: true, write };
}
