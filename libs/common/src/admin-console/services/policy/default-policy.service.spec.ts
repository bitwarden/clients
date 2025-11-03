import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { FakeSingleUserState } from "../../../../spec/fake-state";
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
import { PolicyId, UserId } from "../../../types/guid";
import { OrganizationService } from "../../abstractions/organization/organization.service.abstraction";

import { DefaultPolicyService, getFirstPolicy } from "./default-policy.service";
import { POLICIES } from "./policy-state";

describe("PolicyService", () => {
  const userId = "userId" as UserId;
  let stateProvider: FakeStateProvider;
  let organizationService: MockProxy<OrganizationService>;
  let singleUserState: FakeSingleUserState<Record<PolicyId, PolicyData>>;

  let policyService: DefaultPolicyService;

  beforeEach(() => {
    const accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
    organizationService = mock<OrganizationService>();
    singleUserState = stateProvider.singleUser.getFake(userId, POLICIES);

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

    organizationService.organizations$.calledWith(userId).mockReturnValue(organizations$);

    policyService = new DefaultPolicyService(stateProvider, organizationService);
  });

  it("upsert", async () => {
    singleUserState.nextState(
      arrayToRecord([
        policyData("1", "test-organization", PolicyType.MaximumVaultTimeout, true, { minutes: 14 }),
      ]),
    );

    await policyService.upsert(
      policyData("99", "test-organization", PolicyType.DisableSend, true),
      userId,
    );

    expect(await firstValueFrom(policyService.policies$(userId))).toEqual([
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
    singleUserState.nextState(
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

    expect(await firstValueFrom(policyService.policies$(userId))).toEqual([
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
      jest.spyOn(policyService as any, "policies$").mockReturnValue(of(model));

      const result = await firstValueFrom(policyService.masterPasswordPolicyOptions$(userId));

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

    it("returns undefined", async () => {
      const data: any = {};
      const model = [
        new Policy(
          policyData("3", "test-organization-3", PolicyType.DisablePersonalVaultExport, true, data),
        ),
        new Policy(
          policyData("4", "test-organization-3", PolicyType.MaximumVaultTimeout, true, data),
        ),
      ];
      jest.spyOn(policyService as any, "policies$").mockReturnValue(of(model));

      const result = await firstValueFrom(policyService.masterPasswordPolicyOptions$(userId));

      expect(result).toBeUndefined();
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
      jest.spyOn(policyService as any, "policies$").mockReturnValue(of(model));

      const result = await firstValueFrom(policyService.masterPasswordPolicyOptions$(userId));

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

  describe("policiesByType$", () => {
    it("returns the specified PolicyType", async () => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy2", "org1", PolicyType.DisablePersonalVaultExport, true),
        ]),
      );

      const result = await firstValueFrom(
        policyService
          .policiesByType$(PolicyType.DisablePersonalVaultExport, userId)
          .pipe(getFirstPolicy),
      );

      expect(result).toEqual({
        id: "policy2",
        organizationId: "org1",
        type: PolicyType.DisablePersonalVaultExport,
        enabled: true,
      });
    });

    it("does not return disabled policies", async () => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy2", "org1", PolicyType.DisablePersonalVaultExport, false),
        ]),
      );

      const result = await firstValueFrom(
        policyService
          .policiesByType$(PolicyType.DisablePersonalVaultExport, userId)
          .pipe(getFirstPolicy),
      );

      expect(result).toBeUndefined();
    });

    it("does not return policies that do not apply to the user because the user's role is exempt", async () => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy2", "org2", PolicyType.DisablePersonalVaultExport, false),
        ]),
      );

      const result = await firstValueFrom(
        policyService
          .policiesByType$(PolicyType.DisablePersonalVaultExport, userId)
          .pipe(getFirstPolicy),
      );
      expect(result).toBeUndefined();
    });

    it.each([
      ["owners", "org2"],
      ["administrators", "org6"],
    ])("returns the password generator policy for %s", async (_, organization) => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org1", PolicyType.ActivateAutofill, false),
          policyData("policy2", organization, PolicyType.PasswordGenerator, true),
        ]),
      );

      const result = await firstValueFrom(
        policyService.policiesByType$(PolicyType.PasswordGenerator, userId).pipe(getFirstPolicy),
      );

      expect(result).toBeTruthy();
    });

    it("does not return policies for organizations that do not use policies", async () => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org3", PolicyType.ActivateAutofill, true),
          policyData("policy2", "org2", PolicyType.DisablePersonalVaultExport, true),
        ]),
      );

      const result = await firstValueFrom(
        policyService.policiesByType$(PolicyType.ActivateAutofill, userId).pipe(getFirstPolicy),
      );

      expect(result).toBeUndefined();
    });
  });

  describe("policies$", () => {
    it("returns all policies when none are disabled", async () => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org4", PolicyType.DisablePersonalVaultExport, true),
          policyData("policy2", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy3", "org5", PolicyType.DisablePersonalVaultExport, true),
          policyData("policy4", "org1", PolicyType.DisablePersonalVaultExport, true),
        ]),
      );

      const result = await firstValueFrom(policyService.policies$(userId));

      expect(result).toEqual([
        {
          id: "policy1",
          organizationId: "org4",
          type: PolicyType.DisablePersonalVaultExport,
          enabled: true,
        },
        {
          id: "policy2",
          organizationId: "org1",
          type: PolicyType.ActivateAutofill,
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

    it("returns all policies when some are disabled", async () => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org4", PolicyType.DisablePersonalVaultExport, true),
          policyData("policy2", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy3", "org5", PolicyType.DisablePersonalVaultExport, false), // disabled
          policyData("policy4", "org1", PolicyType.DisablePersonalVaultExport, true),
        ]),
      );

      const result = await firstValueFrom(policyService.policies$(userId));

      expect(result).toEqual([
        {
          id: "policy1",
          organizationId: "org4",
          type: PolicyType.DisablePersonalVaultExport,
          enabled: true,
        },
        {
          id: "policy2",
          organizationId: "org1",
          type: PolicyType.ActivateAutofill,
          enabled: true,
        },
        {
          id: "policy3",
          organizationId: "org5",
          type: PolicyType.DisablePersonalVaultExport,
          enabled: false,
        },
        {
          id: "policy4",
          organizationId: "org1",
          type: PolicyType.DisablePersonalVaultExport,
          enabled: true,
        },
      ]);
    });

    it("returns policies that do not apply to the user because the user's role is exempt", async () => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org4", PolicyType.DisablePersonalVaultExport, true),
          policyData("policy2", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy3", "org5", PolicyType.DisablePersonalVaultExport, true),
          policyData("policy4", "org2", PolicyType.DisablePersonalVaultExport, true), // owner
        ]),
      );

      const result = await firstValueFrom(policyService.policies$(userId));

      expect(result).toEqual([
        {
          id: "policy1",
          organizationId: "org4",
          type: PolicyType.DisablePersonalVaultExport,
          enabled: true,
        },
        {
          id: "policy2",
          organizationId: "org1",
          type: PolicyType.ActivateAutofill,
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
          organizationId: "org2",
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

      const result = await firstValueFrom(policyService.policies$(userId));

      expect(result).toEqual([
        {
          id: "policy1",
          organizationId: "org4",
          type: PolicyType.DisablePersonalVaultExport,
          enabled: true,
        },
        {
          id: "policy2",
          organizationId: "org1",
          type: PolicyType.ActivateAutofill,
          enabled: true,
        },
        {
          id: "policy3",
          organizationId: "org3",
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

  describe("policyAppliesToUser$", () => {
    it("returns true when the policyType applies to the user", async () => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org4", PolicyType.DisablePersonalVaultExport, true),
          policyData("policy2", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy3", "org5", PolicyType.DisablePersonalVaultExport, true),
          policyData("policy4", "org1", PolicyType.DisablePersonalVaultExport, true),
        ]),
      );

      const result = await firstValueFrom(
        policyService.policyAppliesToUser$(PolicyType.DisablePersonalVaultExport, userId),
      );

      expect(result).toBe(true);
    });

    test.each([
      PolicyType.PasswordGenerator,
      PolicyType.FreeFamiliesSponsorshipPolicy,
      PolicyType.RestrictedItemTypes,
      PolicyType.RemoveUnlockWithPin,
    ])("returns true and owners are not exempt from policy %s", async (policyType) => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org2", PolicyType.PasswordGenerator, true),
          policyData("policy2", "org2", PolicyType.FreeFamiliesSponsorshipPolicy, true),
          policyData("policy3", "org2", PolicyType.RestrictedItemTypes, true),
          policyData("policy4", "org2", PolicyType.RemoveUnlockWithPin, true),
        ]),
      );

      const result = await firstValueFrom(policyService.policyAppliesToUser$(policyType, userId));

      expect(result).toBe(true);
    });

    it("returns false when policyType is disabled", async () => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy2", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy3", "org5", PolicyType.DisablePersonalVaultExport, false), // disabled
        ]),
      );

      const result = await firstValueFrom(
        policyService.policyAppliesToUser$(PolicyType.DisablePersonalVaultExport, userId),
      );

      expect(result).toBe(false);
    });

    it("returns false when the policyType does not apply to the user because the user's role is exempt", async () => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy2", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy4", "org2", PolicyType.DisablePersonalVaultExport, true), // owner
        ]),
      );

      const result = await firstValueFrom(
        policyService.policyAppliesToUser$(PolicyType.DisablePersonalVaultExport, userId),
      );

      expect(result).toBe(false);
    });

    it("returns false for organizations that do not use policies", async () => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy2", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy3", "org3", PolicyType.DisablePersonalVaultExport, true), // does not use policies
        ]),
      );

      const result = await firstValueFrom(
        policyService.policyAppliesToUser$(PolicyType.DisablePersonalVaultExport, userId),
      );

      expect(result).toBe(false);
    });

    describe("SingleOrg policy exemptions", () => {
      it("returns true for SingleOrg policy when AutoConfirm is enabled, even for users who can manage policies", async () => {
        singleUserState.nextState(
          arrayToRecord([
            policyData("policy1", "org6", PolicyType.SingleOrg, true),
            policyData("policy2", "org6", PolicyType.AutoConfirm, true),
          ]),
        );

        const result = await firstValueFrom(
          policyService.policyAppliesToUser$(PolicyType.SingleOrg, userId),
        );

        expect(result).toBe(true);
      });

      it("returns false for SingleOrg policy when user can manage policies and AutoConfirm is not enabled", async () => {
        singleUserState.nextState(
          arrayToRecord([policyData("policy1", "org6", PolicyType.SingleOrg, true)]),
        );

        const result = await firstValueFrom(
          policyService.policyAppliesToUser$(PolicyType.SingleOrg, userId),
        );

        expect(result).toBe(false);
      });

      it("returns false for SingleOrg policy when user can manage policies and AutoConfirm is disabled", async () => {
        singleUserState.nextState(
          arrayToRecord([
            policyData("policy1", "org6", PolicyType.SingleOrg, true),
            policyData("policy2", "org6", PolicyType.AutoConfirm, false),
          ]),
        );

        const result = await firstValueFrom(
          policyService.policyAppliesToUser$(PolicyType.SingleOrg, userId),
        );

        expect(result).toBe(false);
      });

      it("returns true for SingleOrg policy for regular users when AutoConfirm is not enabled", async () => {
        singleUserState.nextState(
          arrayToRecord([policyData("policy1", "org1", PolicyType.SingleOrg, true)]),
        );

        const result = await firstValueFrom(
          policyService.policyAppliesToUser$(PolicyType.SingleOrg, userId),
        );

        expect(result).toBe(true);
      });

      it("returns true for SingleOrg policy when AutoConfirm is enabled in a different organization", async () => {
        singleUserState.nextState(
          arrayToRecord([
            policyData("policy1", "org6", PolicyType.SingleOrg, true),
            policyData("policy2", "org1", PolicyType.AutoConfirm, true),
          ]),
        );

        const result = await firstValueFrom(
          policyService.policyAppliesToUser$(PolicyType.SingleOrg, userId),
        );

        expect(result).toBe(false);
      });
    });
  });

  describe("combinePoliciesIntoMasterPasswordPolicyOptions", () => {
    let policyService: DefaultPolicyService;
    let stateProvider: FakeStateProvider;
    let organizationService: MockProxy<OrganizationService>;

    beforeEach(() => {
      stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
      organizationService = mock<OrganizationService>();
      policyService = new DefaultPolicyService(stateProvider, organizationService);
    });

    it("returns undefined when there are no policies", () => {
      const result = policyService.combinePoliciesIntoMasterPasswordPolicyOptions([]);
      expect(result).toBeUndefined();
    });

    it("returns options for a single policy", () => {
      const masterPasswordPolicyRequirements = {
        minComplexity: 3,
        minLength: 10,
        requireUpper: true,
      };
      const policies = [
        new Policy(
          policyData(
            "1",
            "org1",
            PolicyType.MasterPassword,
            true,
            masterPasswordPolicyRequirements,
          ),
        ),
      ];

      const result = policyService.combinePoliciesIntoMasterPasswordPolicyOptions(policies);

      expect(result).toEqual({
        minComplexity: 3,
        minLength: 10,
        requireUpper: true,
        requireLower: false,
        requireNumbers: false,
        requireSpecial: false,
        enforceOnLogin: false,
      });
    });

    it("merges options from multiple policies", () => {
      const masterPasswordPolicyRequirements1 = {
        minComplexity: 3,
        minLength: 10,
        requireUpper: true,
      };
      const masterPasswordPolicyRequirements2 = { minComplexity: 5, requireNumbers: true };
      const policies = [
        new Policy(
          policyData(
            "1",
            "org1",
            PolicyType.MasterPassword,
            true,
            masterPasswordPolicyRequirements1,
          ),
        ),
        new Policy(
          policyData(
            "2",
            "org2",
            PolicyType.MasterPassword,
            true,
            masterPasswordPolicyRequirements2,
          ),
        ),
      ];

      const result = policyService.combinePoliciesIntoMasterPasswordPolicyOptions(policies);

      expect(result).toEqual({
        minComplexity: 5,
        minLength: 10,
        requireUpper: true,
        requireLower: false,
        requireNumbers: true,
        requireSpecial: false,
        enforceOnLogin: false,
      });
    });

    it("ignores disabled policies", () => {
      const masterPasswordPolicyRequirements = {
        minComplexity: 3,
        minLength: 10,
        requireUpper: true,
      };
      const policies = [
        new Policy(
          policyData(
            "1",
            "org1",
            PolicyType.MasterPassword,
            false,
            masterPasswordPolicyRequirements,
          ),
        ),
      ];

      const result = policyService.combinePoliciesIntoMasterPasswordPolicyOptions(policies);

      expect(result).toBeUndefined();
    });

    it("ignores policies with no data", () => {
      const policies = [new Policy(policyData("1", "org1", PolicyType.MasterPassword, true))];

      const result = policyService.combinePoliciesIntoMasterPasswordPolicyOptions(policies);

      expect(result).toBeUndefined();
    });

    it("returns undefined when policies are not MasterPassword related", () => {
      const unrelatedPolicyRequirements = {
        minComplexity: 3,
        minLength: 10,
        requireUpper: true,
      };
      const policies = [
        new Policy(
          policyData(
            "1",
            "org1",
            PolicyType.MaximumVaultTimeout,
            true,
            unrelatedPolicyRequirements,
          ),
        ),
        new Policy(
          policyData("2", "org2", PolicyType.DisableSend, true, unrelatedPolicyRequirements),
        ),
      ];

      const result = policyService.combinePoliciesIntoMasterPasswordPolicyOptions(policies);

      expect(result).toBeUndefined();
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
