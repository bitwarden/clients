import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import {
  vNextOrganizationDataOwnershipPolicy,
  vNextOrganizationDataOwnershipPolicyComponent,
} from "./vnext-organization-data-ownership.component";

const ORG_ID = "org1" as OrganizationId;

function makePolicyResponse(enabled: boolean, data: object | null = null) {
  return new PolicyStatusResponse({
    OrganizationId: ORG_ID,
    Type: PolicyType.OrganizationDataOwnership,
    Enabled: enabled,
    Data: data,
  });
}

describe("vNextOrganizationDataOwnershipPolicy", () => {
  const policy = new vNextOrganizationDataOwnershipPolicy();

  it("should have correct attributes", () => {
    expect(policy.name).toEqual("centralizeDataOwnership");
    expect(policy.description).toEqual("centralizeDataOwnershipDesc");
    expect(policy.type).toEqual(PolicyType.OrganizationDataOwnership);
    expect(policy.component).toEqual(vNextOrganizationDataOwnershipPolicyComponent);
  });
});

describe("vNextOrganizationDataOwnershipPolicyComponent", () => {
  let component: vNextOrganizationDataOwnershipPolicyComponent;
  let fixture: ComponentFixture<vNextOrganizationDataOwnershipPolicyComponent>;
  let mockOrganizationService: MockProxy<OrganizationService>;
  let mockAccountService: MockProxy<AccountService>;

  function setupOrg(useMyItems: boolean) {
    mockOrganizationService.organizations$.mockReturnValue(
      of([{ id: ORG_ID, useMyItems } as Organization]),
    );
  }

  beforeEach(async () => {
    mockOrganizationService = mock<OrganizationService>();
    mockAccountService = mock<AccountService>();

    mockAccountService.activeAccount$ = of({ id: "user1" as UserId } as any);
    mockOrganizationService.organizations$.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: EncryptService, useValue: mock<EncryptService>() },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: AccountService, useValue: mockAccountService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(vNextOrganizationDataOwnershipPolicyComponent);
    component = fixture.componentInstance;
  });

  describe("loadData with null server response", () => {
    it("should default enableIndividualItemsTransfer to false when data is null", async () => {
      component.policyResponse = makePolicyResponse(true, null);

      await component.ngOnInit();

      expect(component.data.controls.enableIndividualItemsTransfer.value).toBe(false);
    });

    it("should default enableIndividualItemsTransfer to false when the attribute is null", async () => {
      component.policyResponse = makePolicyResponse(true, { enableIndividualItemsTransfer: null });

      await component.ngOnInit();

      expect(component.data.controls.enableIndividualItemsTransfer.value).toBe(false);
    });
  });

  describe("useMyItems conditional behavior", () => {
    it("should enable enableIndividualItemsTransfer control when policy is enabled and organization.useMyItems is true", async () => {
      setupOrg(true);
      component.policyResponse = makePolicyResponse(true);

      await component.ngOnInit();

      expect(component.data.controls.enableIndividualItemsTransfer.enabled).toBe(true);
    });

    it("should keep enableIndividualItemsTransfer control disabled when policy is enabled but organization.useMyItems is false", async () => {
      setupOrg(false);
      component.policyResponse = makePolicyResponse(true);

      await component.ngOnInit();

      expect(component.data.controls.enableIndividualItemsTransfer.disabled).toBe(true);
    });

    it("should keep enableIndividualItemsTransfer control disabled when organization is not found", async () => {
      // mockOrganizationService returns [] by default (no org found)
      component.policyResponse = makePolicyResponse(true);

      await component.ngOnInit();

      expect(component.data.controls.enableIndividualItemsTransfer.disabled).toBe(true);
    });

    it("should enable enableIndividualItemsTransfer control when enabled changes to true and useMyItems is true", async () => {
      setupOrg(true);
      component.policyResponse = makePolicyResponse(false);
      await component.ngOnInit();

      component.enabled.setValue(true);

      expect(component.data.controls.enableIndividualItemsTransfer.enabled).toBe(true);
    });

    it("should keep enableIndividualItemsTransfer control disabled when enabled changes to true but useMyItems is false", async () => {
      setupOrg(false);
      component.policyResponse = makePolicyResponse(false);
      await component.ngOnInit();

      component.enabled.setValue(true);

      expect(component.data.controls.enableIndividualItemsTransfer.disabled).toBe(true);
    });
  });

  describe("buildRequestData", () => {
    it("should return enableIndividualItemsTransfer: false when useMyItems is false, even if control value is true", async () => {
      setupOrg(false);
      component.policyResponse = makePolicyResponse(true, { enableIndividualItemsTransfer: true });

      await component.ngOnInit();

      const result = component["buildRequestData"]();

      expect(result.enableIndividualItemsTransfer).toBe(false);
    });

    it("should return enableIndividualItemsTransfer: true when useMyItems is true and control value is true", async () => {
      setupOrg(true);
      component.policyResponse = makePolicyResponse(true, { enableIndividualItemsTransfer: true });

      await component.ngOnInit();

      const result = component["buildRequestData"]();

      expect(result.enableIndividualItemsTransfer).toBe(true);
    });
  });
});
