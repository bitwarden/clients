import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { FakeActiveUserState, FakeSingleUserState } from "../../../../spec/fake-state";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
  PolicyType,
} from "../../../admin-console/enums";
import { PermissionsApi } from "../../../admin-console/models/api/permissions.api";
import { OrganizationData } from "../../../admin-console/models/data/organization.data";
import { PolicyData } from "../../../admin-console/models/data/policy.data";
import { MasterPasswordPolicyOptions } from "../../../admin-console/models/domain/master-password-policy-options";
import { Organization } from "../../../admin-console/models/domain/organization";
import { Policy } from "../../../admin-console/models/domain/policy";
import { ResetPasswordPolicyOptions } from "../../../admin-console/models/domain/reset-password-policy-options";
import { POLICIES, PolicyService } from "../../../admin-console/services/policy/policy.service";
import { PolicyId, UserId } from "../../../types/guid";
import { OrganizationService } from "../../abstractions/organization/organization.service.abstraction";

describe("PolicyService", () => {
  const userId = "userId" as UserId;
  let stateProvider: FakeStateProvider;
  let organizationService: MockProxy<OrganizationService>;
  let activeUserState: FakeActiveUserState<Record<PolicyId, PolicyData>>;
  let singleUserState: FakeSingleUserState<Record<PolicyId, PolicyData>>;

  let policyService: PolicyService;

  beforeEach(() => {
    const accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
    organizationService = mock<OrganizationService>();

    activeUserState = stateProvider.activeUser.getFake(POLICIES);
    singleUserState = stateProvider.singleUser.getFake(activeUserState.userId, POLICIES);

    const organizations$ = of([
      // User
      organization("org1", true, true, OrganizationUserStatusType.Confirmed, false),
      // Owner
      organization(
        "org2",
        true,
        true,
        OrganizationUserStatusType.Confirmed,
        false,
        OrganizationUserType.Owner,
      ),
      // Does not use policies
      organization("org3", true, false, OrganizationUserStatusType.Confirmed, false),
      // Another User
      organization("org4", true, true, OrganizationUserStatusType.Confirmed, false),
      // Another User
      organization("org5", true, true, OrganizationUserStatusType.Confirmed, false),
      // Can manage policies
      organization("org6", true, true, OrganizationUserStatusType.Confirmed, true),
    ]);

    organizationService.organizations$.mockReturnValue(organizations$);

    policyService = new PolicyService(stateProvider, organizationService);
  });

  it("upsert", async () => {
    activeUserState.nextState(
      arrayToRecord([
        policyData("1", "test-organization", PolicyType.MaximumVaultTimeout, true, { minutes: 14 }),
      ]),
    );

    await policyService.upsert(policyData("99", "test-organization", PolicyType.DisableSend, true));

    expect(await firstValueFrom(policyService.policies$)).toEqual([
      {
        id: "1",
        organizationId: "test-organization",
        type: PolicyType.MaximumVaultTimeout,
        enabled: true,
        data: { minutes: 14 },
      },
      {
        id: "99",
        organizationId: "test-organization",
        type: PolicyType.DisableSend,
        enabled: true,
      },
    ]);
  });

  it("replace", async () => {
    activeUserState.nextState(
      arrayToRecord([
        policyData("1", "test-organization", PolicyType.MaximumVaultTimeout, true, { minutes: 14 }),
      ]),
    );

    await policyService.replace(
      {
        "2": policyData("2", "test-organization", PolicyType.DisableSend, true),
      },
      userId,
    );

    expect(await firstValueFrom(policyService.policies$)).toEqual([
      {
        id: "2",
        organizationId: "test-organization",
        type: PolicyType.DisableSend,
        enabled: true,
      },
    ]);
  });

  describe("masterPasswordPolicyOptions", () => {
    it("returns default policy options", async () => {
      const data: any = {
        minComplexity: 5,
        minLength: 20,
        requireUpper: true,
      };
      const model = [
        new Policy(policyData("1", "test-organization-3", PolicyType.MasterPassword, true, data)),
      ];
      const result = await firstValueFrom(policyService.masterPasswordPolicyOptions$(model));

      expect(result).toEqual({
        minComplexity: 5,
        minLength: 20,
        requireLower: false,
        requireNumbers: false,
        requireSpecial: false,
        requireUpper: true,
        enforceOnLogin: false,
      });
    });

    it("returns null", async () => {
      const data: any = {};
      const model = [
        new Policy(
          policyData("3", "test-organization-3", PolicyType.DisablePersonalVaultExport, true, data),
        ),
        new Policy(
          policyData("4", "test-organization-3", PolicyType.MaximumVaultTimeout, true, data),
        ),
      ];

      const result = await firstValueFrom(policyService.masterPasswordPolicyOptions$(model));

      expect(result).toEqual(null);
    });

    it("returns specified policy options", async () => {
      const data: any = {
        minLength: 14,
      };
      const model = [
        new Policy(
          policyData("3", "test-organization-3", PolicyType.DisablePersonalVaultExport, true, data),
        ),
        new Policy(policyData("4", "test-organization-3", PolicyType.MasterPassword, true, data)),
      ];

      const result = await firstValueFrom(policyService.masterPasswordPolicyOptions$(model));

      expect(result).toEqual({
        minComplexity: 0,
        minLength: 14,
        requireLower: false,
        requireNumbers: false,
        requireSpecial: false,
        requireUpper: false,
        enforceOnLogin: false,
      });
    });
  });

  describe("evaluateMasterPassword", () => {
    it("false", async () => {
      const enforcedPolicyOptions = new MasterPasswordPolicyOptions();
      enforcedPolicyOptions.minLength = 14;
      const result = policyService.evaluateMasterPassword(10, "password", enforcedPolicyOptions);

      expect(result).toEqual(false);
    });

    it("true", async () => {
      const enforcedPolicyOptions = new MasterPasswordPolicyOptions();
      const result = policyService.evaluateMasterPassword(0, "password", enforcedPolicyOptions);

      expect(result).toEqual(true);
    });
  });

  describe("getResetPasswordPolicyOptions", () => {
    it("default", async () => {
      const result = policyService.getResetPasswordPolicyOptions([], "");

      expect(result).toEqual([new ResetPasswordPolicyOptions(), false]);
    });

    it("returns autoEnrollEnabled true", async () => {
      const data: any = {
        autoEnrollEnabled: true,
      };
      const policies = [
        new Policy(policyData("5", "test-organization-3", PolicyType.ResetPassword, true, data)),
      ];
      const result = policyService.getResetPasswordPolicyOptions(policies, "test-organization-3");

      expect(result).toEqual([{ autoEnrollEnabled: true }, true]);
    });
  });

  describe("get$", () => {
    it("returns the specified PolicyType", async () => {
      activeUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy2", "org1", PolicyType.DisablePersonalVaultExport, true),
          policyData("policy3", "org1", PolicyType.RemoveUnlockWithPin, true),
        ]),
      );

      await expect(
        firstValueFrom(policyService.get$(PolicyType.ActivateAutofill)),
      ).resolves.toMatchObject({
        id: "policy1",
        organizationId: "org1",
        type: PolicyType.ActivateAutofill,
        enabled: true,
      });
      await expect(
        firstValueFrom(policyService.get$(PolicyType.DisablePersonalVaultExport)),
      ).resolves.toMatchObject({
        id: "policy2",
        organizationId: "org1",
        type: PolicyType.DisablePersonalVaultExport,
        enabled: true,
      });
      await expect(
        firstValueFrom(policyService.get$(PolicyType.RemoveUnlockWithPin)),
      ).resolves.toMatchObject({
        id: "policy3",
        organizationId: "org1",
        type: PolicyType.RemoveUnlockWithPin,
        enabled: true,
      });
    });

    it("does not return disabled policies", async () => {
      activeUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy2", "org1", PolicyType.DisablePersonalVaultExport, false),
        ]),
      );

      const result = await firstValueFrom(
        policyService.get$(PolicyType.DisablePersonalVaultExport),
      );

      expect(result).toBeNull();
    });

    it("does not return policies that do not apply to the user because the user's role is exempt", async () => {
      activeUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy2", "org2", PolicyType.DisablePersonalVaultExport, false),
        ]),
      );

      const result = await firstValueFrom(
        policyService.get$(PolicyType.DisablePersonalVaultExport),
      );

      expect(result).toBeNull();
    });

    it.each([
      ["owners", "org2"],
      ["administrators", "org6"],
    ])("returns the password generator policy for %s", async (_, organization) => {
      activeUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org1", PolicyType.ActivateAutofill, false),
          policyData("policy2", organization, PolicyType.PasswordGenerator, true),
        ]),
      );

      const result = await firstValueFrom(policyService.get$(PolicyType.PasswordGenerator));

      expect(result).toBeTruthy();
    });

    it("does not return policies for organizations that do not use policies", async () => {
      activeUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org3", PolicyType.ActivateAutofill, true),
          policyData("policy2", "org2", PolicyType.DisablePersonalVaultExport, true),
        ]),
      );

      const result = await firstValueFrom(policyService.get$(PolicyType.ActivateAutofill));

      expect(result).toBeNull();
    });
  });

  describe("getAll$", () => {
    it("returns the specified PolicyTypes", async () => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org4", PolicyType.DisablePersonalVaultExport, true),
          policyData("policy2", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy3", "org5", PolicyType.DisablePersonalVaultExport, true),
          policyData("policy4", "org1", PolicyType.DisablePersonalVaultExport, true),
        ]),
      );

      const result = await firstValueFrom(
        policyService.getAll$(PolicyType.DisablePersonalVaultExport, activeUserState.userId),
      );

      expect(result).toEqual([
        {
          id: "policy1",
          organizationId: "org4",
          type: PolicyType.DisablePersonalVaultExport,
          enabled: true,
        },
        {
          id: "policy3",
          organizationId: "org5",
          type: PolicyType.DisablePersonalVaultExport,
          enabled: true,
        },
        {
          id: "policy4",
          organizationId: "org1",
          type: PolicyType.DisablePersonalVaultExport,
          enabled: true,
        },
      ]);
    });

    it("does not return disabled policies", async () => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org4", PolicyType.DisablePersonalVaultExport, true),
          policyData("policy2", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy3", "org5", PolicyType.DisablePersonalVaultExport, false), // disabled
          policyData("policy4", "org1", PolicyType.DisablePersonalVaultExport, true),
        ]),
      );

      const result = await firstValueFrom(
        policyService.getAll$(PolicyType.DisablePersonalVaultExport, activeUserState.userId),
      );

      expect(result).toEqual([
        {
          id: "policy1",
          organizationId: "org4",
          type: PolicyType.DisablePersonalVaultExport,
          enabled: true,
        },
        {
          id: "policy4",
          organizationId: "org1",
          type: PolicyType.DisablePersonalVaultExport,
          enabled: true,
        },
      ]);
    });

    it("does not return policies that do not apply to the user because the user's role is exempt", async () => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org4", PolicyType.DisablePersonalVaultExport, true),
          policyData("policy2", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy3", "org5", PolicyType.DisablePersonalVaultExport, true),
          policyData("policy4", "org2", PolicyType.DisablePersonalVaultExport, true), // owner
        ]),
      );

      const result = await firstValueFrom(
        policyService.getAll$(PolicyType.DisablePersonalVaultExport, activeUserState.userId),
      );

      expect(result).toEqual([
        {
          id: "policy1",
          organizationId: "org4",
          type: PolicyType.DisablePersonalVaultExport,
          enabled: true,
        },
        {
          id: "policy3",
          organizationId: "org5",
          type: PolicyType.DisablePersonalVaultExport,
          enabled: true,
        },
      ]);
    });

    it("does not return policies for organizations that do not use policies", async () => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org4", PolicyType.DisablePersonalVaultExport, true),
          policyData("policy2", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy3", "org3", PolicyType.DisablePersonalVaultExport, true), // does not use policies
          policyData("policy4", "org1", PolicyType.DisablePersonalVaultExport, true),
        ]),
      );

      const result = await firstValueFrom(
        policyService.getAll$(PolicyType.DisablePersonalVaultExport, activeUserState.userId),
      );

      expect(result).toEqual([
        {
          id: "policy1",
          organizationId: "org4",
          type: PolicyType.DisablePersonalVaultExport,
          enabled: true,
        },
        {
          id: "policy4",
          organizationId: "org1",
          type: PolicyType.DisablePersonalVaultExport,
          enabled: true,
        },
      ]);
    });
  });

  describe("policyAppliesToActiveUser$", () => {
    it("returns true when the policyType applies to the user", async () => {
      activeUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org4", PolicyType.DisablePersonalVaultExport, true),
          policyData("policy2", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy3", "org5", PolicyType.DisablePersonalVaultExport, true),
          policyData("policy4", "org1", PolicyType.DisablePersonalVaultExport, true),
        ]),
      );

      const result = await firstValueFrom(
        policyService.policyAppliesToActiveUser$(PolicyType.DisablePersonalVaultExport),
      );

      expect(result).toBe(true);
    });

    it("returns false when policyType is disabled", async () => {
      activeUserState.nextState(
        arrayToRecord([
          policyData("policy2", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy3", "org5", PolicyType.DisablePersonalVaultExport, false), // disabled
        ]),
      );

      const result = await firstValueFrom(
        policyService.policyAppliesToActiveUser$(PolicyType.DisablePersonalVaultExport),
      );

      expect(result).toBe(false);
    });

    it("returns false when the policyType does not apply to the user because the user's role is exempt", async () => {
      activeUserState.nextState(
        arrayToRecord([
          policyData("policy2", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy4", "org2", PolicyType.DisablePersonalVaultExport, true), // owner
        ]),
      );

      const result = await firstValueFrom(
        policyService.policyAppliesToActiveUser$(PolicyType.DisablePersonalVaultExport),
      );

      expect(result).toBe(false);
    });

    it("returns false for organizations that do not use policies", async () => {
      activeUserState.nextState(
        arrayToRecord([
          policyData("policy2", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy3", "org3", PolicyType.DisablePersonalVaultExport, true), // does not use policies
        ]),
      );

      const result = await firstValueFrom(
        policyService.policyAppliesToActiveUser$(PolicyType.DisablePersonalVaultExport),
      );

      expect(result).toBe(false);
    });
  });

  function policyData(
    id: string,
    organizationId: string,
    type: PolicyType,
    enabled: boolean,
    data?: any,
  ) {
    const policyData = new PolicyData({} as any);
    policyData.id = id as PolicyId;
    policyData.organizationId = organizationId;
    policyData.type = type;
    policyData.enabled = enabled;
    policyData.data = data;

    return policyData;
  }

  function organizationData(
    id: string,
    enabled: boolean,
    usePolicies: boolean,
    status: OrganizationUserStatusType,
    managePolicies: boolean,
    type: OrganizationUserType = OrganizationUserType.User,
  ) {
    const organizationData = new OrganizationData({} as any, {} as any);
    organizationData.id = id;
    organizationData.enabled = enabled;
    organizationData.usePolicies = usePolicies;
    organizationData.status = status;
    organizationData.permissions = new PermissionsApi({ managePolicies: managePolicies } as any);
    organizationData.type = type;
    return organizationData;
  }

  function organization(
    id: string,
    enabled: boolean,
    usePolicies: boolean,
    status: OrganizationUserStatusType,
    managePolicies: boolean,
    type: OrganizationUserType = OrganizationUserType.User,
  ) {
    return new Organization(
      organizationData(id, enabled, usePolicies, status, managePolicies, type),
    );
  }

  function arrayToRecord(input: PolicyData[]): Record<PolicyId, PolicyData> {
    return Object.fromEntries(input.map((i) => [i.id, i]));
  }
});
