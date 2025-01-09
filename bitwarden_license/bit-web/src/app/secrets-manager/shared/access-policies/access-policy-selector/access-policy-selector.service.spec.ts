import { mock, MockProxy } from "jest-mock-extended";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

import { AccessPolicySelectorService } from "./access-policy-selector.service";
import { ApItemValueType } from "./models/ap-item-value.type";
import { ApItemViewType } from "./models/ap-item-view.type";
import { ApItemEnum } from "./models/enums/ap-item.enum";
import { ApPermissionEnum } from "./models/enums/ap-permission.enum";

describe("AccessPolicySelectorService", () => {
  let organizationService: MockProxy<OrganizationService>;

  let sut: AccessPolicySelectorService;

  beforeEach(() => {
    organizationService = mock<OrganizationService>();

    sut = new AccessPolicySelectorService(organizationService);
  });

  afterEach(() => jest.resetAllMocks());

  describe("showAccessRemovalWarning", () => {
    it("returns false when current user is admin", async () => {
      const org = orgFactory();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const selectedPolicyValues: ApItemValueType[] = [];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(false);
    });

    it("returns false when current user is owner", async () => {
      const org = orgFactory();
      org.type = OrganizationUserType.Owner;
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const selectedPolicyValues: ApItemValueType[] = [];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(false);
    });

    it("returns true when current user isn't owner/admin and all policies are removed", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const selectedPolicyValues: ApItemValueType[] = [];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(true);
    });

    it("returns true when current user isn't owner/admin and user policy is set to canRead", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const selectedPolicyValues: ApItemValueType[] = [];
      selectedPolicyValues.push(
        createApItemValueType(
          {
            permission: ApPermissionEnum.CanRead,
          },
          true,
        ),
      );

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(true);
    });

    it("returns false when current user isn't owner/admin and user policy is set to canReadWrite", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const selectedPolicyValues: ApItemValueType[] = [
        createApItemValueType(
          {
            permission: ApPermissionEnum.CanReadWrite,
          },
          true,
        ),
      ];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(false);
    });

    it("returns true when current user isn't owner/admin and a group Read policy is submitted that the user is a member of", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const selectedPolicyValues: ApItemValueType[] = [
        createApItemValueType(
          {
            id: "groupId",
            type: ApItemEnum.Group,
            permission: ApPermissionEnum.CanRead,
          },
          false,
          true,
        ),
      ];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(true);
    });

    it("returns false when current user isn't owner/admin and a group ReadWrite policy is submitted that the user is a member of", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const selectedPolicyValues: ApItemValueType[] = [
        createApItemValueType(
          {
            id: "groupId",
            type: ApItemEnum.Group,
            permission: ApPermissionEnum.CanReadWrite,
          },
          false,
          true,
        ),
      ];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(false);
    });

    it("returns true when current user isn't owner/admin and a group ReadWrite policy is submitted that the user is not a member of", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const selectedPolicyValues: ApItemValueType[] = [
        createApItemValueType(
          {
            id: "groupId",
            type: ApItemEnum.Group,
            permission: ApPermissionEnum.CanReadWrite,
          },
          false,
          false,
        ),
      ];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(true);
    });

    it("returns false when current user isn't owner/admin, user policy is set to CanRead, and user is in read write group", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const selectedPolicyValues: ApItemValueType[] = [
        createApItemValueType(
          {
            permission: ApPermissionEnum.CanRead,
          },
          true,
        ),
        createApItemValueType(
          {
            id: "groupId",
            type: ApItemEnum.Group,
            permission: ApPermissionEnum.CanReadWrite,
          },
          false,
          true,
        ),
      ];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(false);
    });

    it("returns true when current user isn't owner/admin, user policy is set to CanRead, and user is not in ReadWrite group", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const selectedPolicyValues: ApItemValueType[] = [
        createApItemValueType(
          {
            permission: ApPermissionEnum.CanRead,
          },
          true,
        ),
        createApItemValueType(
          {
            id: "groupId",
            type: ApItemEnum.Group,
            permission: ApPermissionEnum.CanReadWrite,
          },
          false,
          false,
        ),
      ];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(true);
    });

    it("returns true when current user isn't owner/admin, user policy is set to CanRead, and user is in Read group", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const selectedPolicyValues: ApItemValueType[] = [
        createApItemValueType(
          {
            permission: ApPermissionEnum.CanRead,
          },
          true,
        ),
        createApItemValueType(
          {
            id: "groupId",
            type: ApItemEnum.Group,
            permission: ApPermissionEnum.CanRead,
          },
          false,
          true,
        ),
      ];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(true);
    });
  });
  describe("showSecretAccessRemovalWarning", () => {
    it("returns false when there are no current access policies", async () => {
      const org = orgFactory();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const currentAccessPolicies: ApItemViewType[] = [];
      const selectedPolicyValues: ApItemValueType[] = [];

      const result = await sut.showSecretAccessRemovalWarning(
        org.id,
        currentAccessPolicies,
        selectedPolicyValues,
      );

      expect(result).toBe(false);
    });
    it("returns false when current user is admin", async () => {
      const org = orgFactory();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const currentAccessPolicies: ApItemViewType[] = [
        createApItemViewType(
          {
            id: "example",
            permission: ApPermissionEnum.CanRead,
          },
          true,
        ),
      ];
      const selectedPolicyValues: ApItemValueType[] = [];

      const result = await sut.showSecretAccessRemovalWarning(
        org.id,
        currentAccessPolicies,
        selectedPolicyValues,
      );

      expect(result).toBe(false);
    });
    it("returns false when current user is owner", async () => {
      const org = orgFactory();
      org.type = OrganizationUserType.Owner;
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const currentAccessPolicies: ApItemViewType[] = [
        createApItemViewType(
          {
            id: "example",
            permission: ApPermissionEnum.CanRead,
          },
          true,
        ),
      ];
      const selectedPolicyValues: ApItemValueType[] = [];

      const result = await sut.showSecretAccessRemovalWarning(
        org.id,
        currentAccessPolicies,
        selectedPolicyValues,
      );

      expect(result).toBe(false);
    });
    it("returns false when current non-admin user doesn't have Read, Write access with current access policies -- user policy", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const currentAccessPolicies: ApItemViewType[] = [
        createApItemViewType(
          {
            id: "example",
            permission: ApPermissionEnum.CanRead,
          },
          true,
        ),
      ];
      const selectedPolicyValues: ApItemValueType[] = [];

      const result = await sut.showSecretAccessRemovalWarning(
        org.id,
        currentAccessPolicies,
        selectedPolicyValues,
      );

      expect(result).toBe(false);
    });
    it("returns false when current non-admin user doesn't have Read, Write access with current access policies -- group policy", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const currentAccessPolicies: ApItemViewType[] = [
        createApItemViewType(
          {
            id: "example",
            type: ApItemEnum.Group,
            permission: ApPermissionEnum.CanRead,
          },
          false,
          true,
        ),
      ];
      const selectedPolicyValues: ApItemValueType[] = [];

      const result = await sut.showSecretAccessRemovalWarning(
        org.id,
        currentAccessPolicies,
        selectedPolicyValues,
      );

      expect(result).toBe(false);
    });
    it("returns true when current non-admin user has Read, Write access with current access policies and doesn't with selected -- user policy", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const currentAccessPolicies: ApItemViewType[] = [
        createApItemViewType(
          {
            id: "example",
            permission: ApPermissionEnum.CanReadWrite,
          },
          true,
        ),
      ];
      const selectedPolicyValues: ApItemValueType[] = [
        createApItemValueType({
          type: ApItemEnum.User,
          permission: ApPermissionEnum.CanRead,
          currentUser: true,
        }),
      ];

      const result = await sut.showSecretAccessRemovalWarning(
        org.id,
        currentAccessPolicies,
        selectedPolicyValues,
      );

      expect(result).toBe(true);
    });
    it("returns true when current non-admin user has Read, Write access with current access policies and doesn't with selected -- group policy", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const currentAccessPolicies: ApItemViewType[] = [
        createApItemViewType(
          {
            id: "example",
            type: ApItemEnum.Group,
            permission: ApPermissionEnum.CanReadWrite,
          },
          false,
          true,
        ),
      ];
      const selectedPolicyValues: ApItemValueType[] = [
        createApItemValueType(
          {
            type: ApItemEnum.Group,
            permission: ApPermissionEnum.CanRead,
          },
          false,
          true,
        ),
      ];

      const result = await sut.showSecretAccessRemovalWarning(
        org.id,
        currentAccessPolicies,
        selectedPolicyValues,
      );

      expect(result).toBe(true);
    });
    it("returns false when current non-admin user has Read, Write access with current access policies and does with selected -- user policy", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const currentAccessPolicies: ApItemViewType[] = [
        createApItemViewType(
          {
            id: "example",
            permission: ApPermissionEnum.CanReadWrite,
          },
          true,
        ),
      ];
      const selectedPolicyValues: ApItemValueType[] = [
        createApItemValueType(
          {
            type: ApItemEnum.User,
            permission: ApPermissionEnum.CanReadWrite,
          },
          true,
        ),
      ];

      const result = await sut.showSecretAccessRemovalWarning(
        org.id,
        currentAccessPolicies,
        selectedPolicyValues,
      );

      expect(result).toBe(false);
    });
    it("returns false when current non-admin user has Read, Write access with current access policies and does with selected -- group policy", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const currentAccessPolicies: ApItemViewType[] = [
        createApItemViewType(
          {
            id: "example",
            type: ApItemEnum.Group,
            permission: ApPermissionEnum.CanReadWrite,
          },
          false,
          true,
        ),
      ];
      const selectedPolicyValues: ApItemValueType[] = [
        createApItemValueType(
          {
            type: ApItemEnum.Group,
            permission: ApPermissionEnum.CanReadWrite,
          },
          false,
          true,
        ),
      ];

      const result = await sut.showSecretAccessRemovalWarning(
        org.id,
        currentAccessPolicies,
        selectedPolicyValues,
      );

      expect(result).toBe(false);
    });
  });
  describe("isAccessRemoval", () => {
    it("returns false when there are no previous policies and no selected policies", async () => {
      const currentAccessPolicies: ApItemViewType[] = [];
      const selectedPolicyValues: ApItemValueType[] = [];

      const result = sut.isAccessRemoval(currentAccessPolicies, selectedPolicyValues);

      expect(result).toBe(false);
    });
    it("returns false when there are no previous policies", async () => {
      const currentAccessPolicies: ApItemViewType[] = [];
      const selectedPolicyValues: ApItemValueType[] = [
        createApItemValueType(
          {
            id: "example",
            permission: ApPermissionEnum.CanRead,
          },
          true,
        ),
      ];

      const result = sut.isAccessRemoval(currentAccessPolicies, selectedPolicyValues);

      expect(result).toBe(false);
    });
    it("returns false when previous policies and selected policies are the same", async () => {
      const currentAccessPolicies: ApItemViewType[] = [
        createApItemViewType(
          {
            id: "example",
            permission: ApPermissionEnum.CanRead,
          },
          true,
        ),
      ];
      const selectedPolicyValues: ApItemValueType[] = [
        createApItemValueType(
          {
            id: "example",
            permission: ApPermissionEnum.CanRead,
          },
          true,
        ),
      ];

      const result = sut.isAccessRemoval(currentAccessPolicies, selectedPolicyValues);

      expect(result).toBe(false);
    });
    it("returns false when previous policies are still selected", async () => {
      const currentAccessPolicies: ApItemViewType[] = [
        createApItemViewType(
          {
            id: "example",
            permission: ApPermissionEnum.CanRead,
          },
          true,
        ),
      ];
      const selectedPolicyValues: ApItemValueType[] = [
        createApItemValueType(
          {
            id: "example",
            permission: ApPermissionEnum.CanRead,
          },
          true,
        ),
        createApItemValueType(
          {
            id: "example-2",
            permission: ApPermissionEnum.CanRead,
          },
          true,
        ),
      ];

      const result = sut.isAccessRemoval(currentAccessPolicies, selectedPolicyValues);

      expect(result).toBe(false);
    });
    it("returns true when previous policies are not selected", async () => {
      const currentAccessPolicies: ApItemViewType[] = [
        createApItemViewType(
          {
            id: "example",
            permission: ApPermissionEnum.CanRead,
          },
          true,
        ),
      ];
      const selectedPolicyValues: ApItemValueType[] = [
        createApItemValueType(
          {
            id: "test",
            permission: ApPermissionEnum.CanRead,
          },
          true,
        ),
        createApItemValueType(
          {
            id: "example-2",
            permission: ApPermissionEnum.CanRead,
          },
          true,
        ),
      ];

      const result = sut.isAccessRemoval(currentAccessPolicies, selectedPolicyValues);

      expect(result).toBe(true);
    });
    it("returns true when there are previous policies and nothing was selected", async () => {
      const currentAccessPolicies: ApItemViewType[] = [
        createApItemViewType(
          {
            permission: ApPermissionEnum.CanRead,
          },
          true,
        ),
      ];
      const selectedPolicyValues: ApItemValueType[] = [];

      const result = sut.isAccessRemoval(currentAccessPolicies, selectedPolicyValues);

      expect(result).toBe(true);
    });
  });
});

const orgFactory = (props: Partial<Organization> = {}) =>
  Object.assign(
    new Organization(),
    {
      id: "myOrgId",
      enabled: true,
      type: OrganizationUserType.Admin,
    },
    props,
  );

function createApItemValueType(
  options: Partial<ApItemValueType> = {},
  currentUser = false,
  currentUserInGroup = false,
) {
  const item: ApItemValueType = {
    id: options?.id ?? "test",
    type: options?.type ?? ApItemEnum.User,
    permission: options?.permission ?? ApPermissionEnum.CanRead,
  };
  if (item.type === ApItemEnum.User) {
    item.currentUser = currentUser;
  }
  if (item.type === ApItemEnum.Group) {
    item.currentUserInGroup = currentUserInGroup;
  }
  return item;
}

function createApItemViewType(
  options: Partial<ApItemViewType> = {},
  currentUser = false,
  currentUserInGroup = false,
) {
  const item: ApItemViewType = {
    id: options?.id ?? "test",
    listName: options?.listName ?? "test",
    labelName: options?.labelName ?? "test",
    type: options?.type ?? ApItemEnum.User,
    permission: options?.permission ?? ApPermissionEnum.CanRead,
    readOnly: options?.readOnly ?? false,
  };
  if (item.type === ApItemEnum.User) {
    item.currentUser = currentUser;
  }
  if (item.type === ApItemEnum.Group) {
    item.currentUserInGroup = currentUserInGroup;
  }
  return item;
}

function setupUserOrg() {
  const userId = "testUserId";
  const org = orgFactory({ userId: userId });
  org.type = OrganizationUserType.User;
  return org;
}
