import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { newGuid } from "@bitwarden/guid";
import { PolicyView } from "@bitwarden/sdk-internal";

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
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { MockSdkService } from "../../../platform/spec/mock-sdk.service";
import { PolicyId, UserId } from "../../../types/guid";
import { OrganizationService } from "../../abstractions/organization/organization.service.abstraction";
import { InternalNewPolicyService } from "../../abstractions/policy/new-policy.service";

import { DefaultPolicyService } from "./default-policy.service";
import { POLICIES } from "./policy-state";

describe("PolicyService", () => {
  const userId = newGuid() as UserId;
  let stateProvider: FakeStateProvider;
  let organizationService: MockProxy<OrganizationService>;
  let newPolicyService: MockProxy<InternalNewPolicyService>;
  let sdkService: MockSdkService;
  let singleUserState: FakeSingleUserState<Record<PolicyId, PolicyData>>;
  const accountService = mockAccountServiceWith(userId);

  let policyService: DefaultPolicyService;

  beforeEach(() => {
    stateProvider = new FakeStateProvider(accountService);
    organizationService = mock<OrganizationService>();
    newPolicyService = mock<InternalNewPolicyService>();
    sdkService = new MockSdkService();
    singleUserState = stateProvider.singleUser.getFake(userId, POLICIES);

    organizationService.organizations$.calledWith(userId).mockReturnValue(of([]));
    organizationService.acceptedOrganizations$.calledWith(userId).mockReturnValue(of([]));
    newPolicyService.policies$.calledWith(userId).mockReturnValue(of([]));

    policyService = new DefaultPolicyService(
      stateProvider,
      organizationService,
      accountService,
      newPolicyService,
      () => sdkService,
    );
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
        revisionDate: expect.any(Date),
      },
      {
        id: "99",
        organizationId: "test-organization",
        type: PolicyType.DisableSend,
        enabled: true,
        data: undefined,
        revisionDate: expect.any(Date),
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
        data: undefined,
        revisionDate: expect.any(Date),
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
      jest.spyOn(policyService, "policiesByType$").mockReturnValue(of(model));

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
      jest.spyOn(policyService, "policiesByType$").mockReturnValue(of(model));

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
      jest.spyOn(policyService, "policiesByType$").mockReturnValue(of(model));

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
    const policyId1 = newGuid();
    const policyId2 = newGuid();
    const orgId1 = newGuid();
    const orgId2 = newGuid();

    it("delegates filtering to the SDK and maps the result back to Policy", async () => {
      const policies = [
        new Policy(
          policyData(policyId1, orgId1, PolicyType.MaximumVaultTimeout, true, { minutes: 30 }),
        ),
        new Policy(policyData(policyId2, orgId1, PolicyType.DisableSend, true)),
      ];
      newPolicyService.policies$.calledWith(userId).mockReturnValue(of(policies));

      const confirmed = [
        organization(orgId1, true, true, OrganizationUserStatusType.Confirmed, false),
      ];
      const accepted = [
        organization(orgId2, true, true, OrganizationUserStatusType.Accepted, false),
      ];
      organizationService.organizations$.calledWith(userId).mockReturnValue(of(confirmed));
      organizationService.acceptedOrganizations$.calledWith(userId).mockReturnValue(of(accepted));

      const revisionDate = new Date("2026-01-15T12:00:00.000Z");
      const filterByType = jest.fn().mockReturnValue([
        {
          id: policyId1,
          organizationId: orgId1,
          type: PolicyType.MaximumVaultTimeout as number,
          data: JSON.stringify({ minutes: 30 }),
          enabled: true,
          revisionDate: revisionDate.toISOString(),
        } satisfies PolicyView,
      ]);
      sdkService.client.policies.mockReturnValue({ filter_by_type: filterByType } as any);

      const result = await firstValueFrom(
        policyService.policiesByType$(PolicyType.MaximumVaultTimeout, userId),
      );

      expect(filterByType).toHaveBeenCalledTimes(1);
      const [sdkPolicies, sdkOrgs, type] = filterByType.mock.calls[0];
      expect(sdkPolicies).toHaveLength(2);
      expect(sdkPolicies.map((p: any) => p.id)).toEqual([policyId1, policyId2]);
      expect(sdkOrgs.map((o: any) => o.id)).toEqual([orgId1, orgId2]);
      expect(type).toBe(PolicyType.MaximumVaultTimeout);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: policyId1,
        organizationId: orgId1,
        type: PolicyType.MaximumVaultTimeout,
        data: { minutes: 30 },
        enabled: true,
        revisionDate,
      });
    });

    it("passes undefined to the SDK when a policy has no data", async () => {
      newPolicyService.policies$
        .calledWith(userId)
        .mockReturnValue(
          of([new Policy(policyData(policyId1, orgId1, PolicyType.DisableSend, true, null))]),
        );
      organizationService.organizations$
        .calledWith(userId)
        .mockReturnValue(
          of([organization(orgId1, true, true, OrganizationUserStatusType.Confirmed, false)]),
        );

      const filterByType = jest.fn().mockReturnValue([]);
      sdkService.client.policies.mockReturnValue({ filter_by_type: filterByType } as any);

      await firstValueFrom(policyService.policiesByType$(PolicyType.DisableSend, userId));

      const [sdkPolicies] = filterByType.mock.calls[0];
      expect(sdkPolicies[0].data).toBeUndefined();
    });

    it("maps an SDK PolicyView with no data back to a Policy with null data", async () => {
      newPolicyService.policies$
        .calledWith(userId)
        .mockReturnValue(
          of([new Policy(policyData(policyId1, orgId1, PolicyType.DisableSend, true))]),
        );

      sdkService.client.policies.mockReturnValue({
        filter_by_type: jest.fn().mockReturnValue([
          {
            id: policyId1,
            organizationId: orgId1,
            type: PolicyType.DisableSend as number,
            data: undefined,
            enabled: true,
            revisionDate: new Date().toISOString(),
          } satisfies PolicyView,
        ]),
      } as any);

      const result = await firstValueFrom(
        policyService.policiesByType$(PolicyType.DisableSend, userId),
      );

      expect(result).toHaveLength(1);
      expect(result[0].data).toBeNull();
    });

    it("throws when no userId is provided", () => {
      expect(() => policyService.policiesByType$(PolicyType.DisableSend, undefined as any)).toThrow(
        "No userId provided",
      );
    });
  });

  describe("policyAppliesToUser$", () => {
    it("returns true when policiesByType$ emits a policy", async () => {
      jest
        .spyOn(policyService, "policiesByType$")
        .mockReturnValue(
          of([new Policy(policyData("1", "org1", PolicyType.DisablePersonalVaultExport, true))]),
        );

      const result = await firstValueFrom(
        policyService.policyAppliesToUser$(PolicyType.DisablePersonalVaultExport, userId),
      );

      expect(result).toBe(true);
    });

    it("returns false when policiesByType$ emits no policies", async () => {
      jest.spyOn(policyService, "policiesByType$").mockReturnValue(of([]));

      const result = await firstValueFrom(
        policyService.policyAppliesToUser$(PolicyType.DisablePersonalVaultExport, userId),
      );

      expect(result).toBe(false);
    });
  });

  describe("policies$", () => {
    it("returns all policies from state", async () => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy1", "org4", PolicyType.DisablePersonalVaultExport, true),
          policyData("policy2", "org1", PolicyType.ActivateAutofill, true),
          policyData("policy3", "org5", PolicyType.DisablePersonalVaultExport, false),
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
          data: undefined,
          revisionDate: expect.any(Date),
        },
        {
          id: "policy2",
          organizationId: "org1",
          type: PolicyType.ActivateAutofill,
          enabled: true,
          data: undefined,
          revisionDate: expect.any(Date),
        },
        {
          id: "policy3",
          organizationId: "org5",
          type: PolicyType.DisablePersonalVaultExport,
          enabled: false,
          data: undefined,
          revisionDate: expect.any(Date),
        },
        {
          id: "policy4",
          organizationId: "org1",
          type: PolicyType.DisablePersonalVaultExport,
          enabled: true,
          data: undefined,
          revisionDate: expect.any(Date),
        },
      ]);
    });

    it("returns an empty array when there is no state", async () => {
      singleUserState.nextState(null);

      const result = await firstValueFrom(policyService.policies$(userId));

      expect(result).toEqual([]);
    });
  });

  describe("combinePoliciesIntoMasterPasswordPolicyOptions", () => {
    let policyService: DefaultPolicyService;
    let stateProvider: FakeStateProvider;
    let organizationService: MockProxy<OrganizationService>;

    beforeEach(() => {
      stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
      organizationService = mock<OrganizationService>();
      policyService = new DefaultPolicyService(
        stateProvider,
        organizationService,
        accountService,
        mock<InternalNewPolicyService>(),
        () => mock<SdkService>(),
      );
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
    policyData.revisionDate = new Date().toISOString();

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
