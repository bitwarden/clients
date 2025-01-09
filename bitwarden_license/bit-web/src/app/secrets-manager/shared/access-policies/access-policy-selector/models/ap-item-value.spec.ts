import {
  convertToSecretAccessPoliciesView,
  convertToPeopleAccessPoliciesView,
  ApItemValueType,
  convertToProjectServiceAccountsAccessPoliciesView,
  convertToServiceAccountGrantedPoliciesView,
} from "./ap-item-value.type";
import { ApItemEnum } from "./enums/ap-item.enum";
import { ApPermissionEnum } from "./enums/ap-permission.enum";

describe("convertToPeopleAccessPoliciesView", () => {
  it("should convert selected policy values to user and group access policies view", () => {
    const selectedPolicyValues = [...createUserApItems(), ...createGroupApItems()];

    const result = convertToPeopleAccessPoliciesView(selectedPolicyValues);

    expect(result.userAccessPolicies).toEqual(expectedUserAccessPolicies);
    expect(result.groupAccessPolicies).toEqual(expectedGroupAccessPolicies);
  });

  it("should return empty user array if no selected users are provided", () => {
    const selectedPolicyValues = createGroupApItems();

    const result = convertToPeopleAccessPoliciesView(selectedPolicyValues);

    expect(result.userAccessPolicies).toEqual([]);
    expect(result.groupAccessPolicies).toEqual(expectedGroupAccessPolicies);
  });

  it("should return empty group array if no selected groups are provided", () => {
    const selectedPolicyValues = createUserApItems();

    const result = convertToPeopleAccessPoliciesView(selectedPolicyValues);

    expect(result.userAccessPolicies).toEqual(expectedUserAccessPolicies);
    expect(result.groupAccessPolicies).toEqual([]);
  });

  it("should return empty arrays if no selected policy values are provided", () => {
    const selectedPolicyValues: ApItemValueType[] = [];

    const result = convertToPeopleAccessPoliciesView(selectedPolicyValues);

    expect(result.userAccessPolicies).toEqual([]);
    expect(result.groupAccessPolicies).toEqual([]);
  });
});

describe("convertToServiceAccountGrantedPoliciesView", () => {
  it("should convert selected policy values to ServiceAccountGrantedPoliciesView", () => {
    const selectedPolicyValues = createProjectApItems();

    const result = convertToServiceAccountGrantedPoliciesView(selectedPolicyValues);

    expect(result.grantedProjectPolicies).toHaveLength(2);
    expect(result.grantedProjectPolicies[0].accessPolicy.grantedProjectId).toBe(
      selectedPolicyValues[0].id,
    );
    expect(result.grantedProjectPolicies[0].accessPolicy.read).toBe(true);
    expect(result.grantedProjectPolicies[0].accessPolicy.write).toBe(false);

    expect(result.grantedProjectPolicies[1].accessPolicy.grantedProjectId).toBe(
      selectedPolicyValues[1].id,
    );
    expect(result.grantedProjectPolicies[1].accessPolicy.read).toBe(true);
    expect(result.grantedProjectPolicies[1].accessPolicy.write).toBe(true);
  });

  it("should return empty array if no selected project policies are provided", () => {
    const selectedPolicyValues: ApItemValueType[] = [];

    const result = convertToServiceAccountGrantedPoliciesView(selectedPolicyValues);

    expect(result.grantedProjectPolicies).toEqual([]);
  });
});

describe("convertToProjectServiceAccountsAccessPoliciesView", () => {
  it("should convert selected policy values to ProjectServiceAccountsAccessPoliciesView", () => {
    const selectedPolicyValues = createServiceAccountApItems();

    const result = convertToProjectServiceAccountsAccessPoliciesView(selectedPolicyValues);

    expect(result.serviceAccountAccessPolicies).toEqual(expectedServiceAccountAccessPolicies);
  });

  it("should return empty array if nothing is selected.", () => {
    const selectedPolicyValues: ApItemValueType[] = [];

    const result = convertToProjectServiceAccountsAccessPoliciesView(selectedPolicyValues);

    expect(result.serviceAccountAccessPolicies).toEqual([]);
  });
});

describe("convertToSecretAccessPoliciesView", () => {
  it("should convert selected policy values to SecretAccessPoliciesView", () => {
    const selectedPolicyValues = [
      ...createUserApItems(),
      ...createGroupApItems(),
      ...createServiceAccountApItems(),
    ];
    const result = convertToSecretAccessPoliciesView(selectedPolicyValues);

    expect(result.userAccessPolicies).toEqual(expectedUserAccessPolicies);
    expect(result.groupAccessPolicies).toEqual(expectedGroupAccessPolicies);
    expect(result.serviceAccountAccessPolicies).toEqual(expectedServiceAccountAccessPolicies);
  });

  it("should return empty user array if no selected users are provided", () => {
    const selectedPolicyValues = [...createGroupApItems(), ...createServiceAccountApItems()];

    const result = convertToSecretAccessPoliciesView(selectedPolicyValues);

    expect(result.userAccessPolicies).toEqual([]);
    expect(result.groupAccessPolicies).toEqual(expectedGroupAccessPolicies);
    expect(result.serviceAccountAccessPolicies).toEqual(expectedServiceAccountAccessPolicies);
  });

  it("should return empty group array if no selected groups are provided", () => {
    const selectedPolicyValues = [...createUserApItems(), ...createServiceAccountApItems()];

    const result = convertToSecretAccessPoliciesView(selectedPolicyValues);

    expect(result.userAccessPolicies).toEqual(expectedUserAccessPolicies);
    expect(result.groupAccessPolicies).toEqual([]);
    expect(result.serviceAccountAccessPolicies).toEqual(expectedServiceAccountAccessPolicies);
  });

  it("should return empty service account array if no selected service accounts are provided", () => {
    const selectedPolicyValues = [...createUserApItems(), ...createGroupApItems()];

    const result = convertToSecretAccessPoliciesView(selectedPolicyValues);

    expect(result.userAccessPolicies).toEqual(expectedUserAccessPolicies);
    expect(result.groupAccessPolicies).toEqual(expectedGroupAccessPolicies);
    expect(result.serviceAccountAccessPolicies).toEqual([]);
  });

  it("should return empty arrays if nothing is selected.", () => {
    const selectedPolicyValues: ApItemValueType[] = [];

    const result = convertToSecretAccessPoliciesView(selectedPolicyValues);

    expect(result.userAccessPolicies).toEqual([]);
    expect(result.groupAccessPolicies).toEqual([]);
    expect(result.serviceAccountAccessPolicies).toEqual([]);
  });
});

function createUserApItems(): ApItemValueType[] {
  return [
    {
      id: "1",
      type: ApItemEnum.User,
      permission: ApPermissionEnum.CanRead,
    },
    {
      id: "3",
      type: ApItemEnum.User,
      permission: ApPermissionEnum.CanReadWrite,
    },
  ];
}

const expectedUserAccessPolicies = [
  {
    organizationUserId: "1",
    read: true,
    write: false,
  },
  {
    organizationUserId: "3",
    read: true,
    write: true,
  },
];

function createServiceAccountApItems(): ApItemValueType[] {
  return [
    {
      id: "1",
      type: ApItemEnum.ServiceAccount,
      permission: ApPermissionEnum.CanRead,
    },
    {
      id: "2",
      type: ApItemEnum.ServiceAccount,
      permission: ApPermissionEnum.CanReadWrite,
    },
  ];
}

const expectedServiceAccountAccessPolicies = [
  {
    serviceAccountId: "1",
    read: true,
    write: false,
  },
  {
    serviceAccountId: "2",
    read: true,
    write: true,
  },
];

function createGroupApItems(): ApItemValueType[] {
  return [
    {
      id: "2",
      type: ApItemEnum.Group,
      permission: ApPermissionEnum.CanReadWrite,
    },
  ];
}

const expectedGroupAccessPolicies = [
  {
    groupId: "2",
    read: true,
    write: true,
  },
];

function createProjectApItems(): ApItemValueType[] {
  return [
    {
      id: "1",
      type: ApItemEnum.Project,
      permission: ApPermissionEnum.CanRead,
    },
    {
      id: "2",
      type: ApItemEnum.Project,
      permission: ApPermissionEnum.CanReadWrite,
    },
  ];
}
