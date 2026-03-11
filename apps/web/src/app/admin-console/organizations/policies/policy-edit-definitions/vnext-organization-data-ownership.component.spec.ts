import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock } from "jest-mock-extended";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import {
  vNextOrganizationDataOwnershipPolicy,
  vNextOrganizationDataOwnershipPolicyComponent,
} from "./vnext-organization-data-ownership.component";

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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: EncryptService, useValue: mock<EncryptService>() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(vNextOrganizationDataOwnershipPolicyComponent);
    component = fixture.componentInstance;
  });

  describe("loadData with null server response", () => {
    it("should default enableIndividualItemsTransfer to false when data is null", () => {
      component.policyResponse = new PolicyStatusResponse({
        organizationId: "org1",
        type: PolicyType.OrganizationDataOwnership,
        enabled: true,
        data: null,
      });

      component.ngOnInit();

      expect(component.data.controls.enableIndividualItemsTransfer.value).toBe(false);
    });

    it("should default enableIndividualItemsTransfer to false when the attribute is null", () => {
      component.policyResponse = new PolicyStatusResponse({
        organizationId: "org1",
        type: PolicyType.OrganizationDataOwnership,
        enabled: true,
        data: { enableIndividualItemsTransfer: null },
      });

      component.ngOnInit();

      expect(component.data.controls.enableIndividualItemsTransfer.value).toBe(false);
    });
  });

  describe("useMyItems conditional behavior", () => {
    it("should enable enableIndividualItemsTransfer control when policy is enabled and organization.useMyItems is true", () => {
      component.organization = { useMyItems: true } as Organization;
      component.policyResponse = new PolicyStatusResponse({
        organizationId: "org1",
        type: PolicyType.OrganizationDataOwnership,
        enabled: true,
        data: null,
      });

      component.ngOnInit();

      expect(component.data.controls.enableIndividualItemsTransfer.enabled).toBe(true);
    });

    it("should keep enableIndividualItemsTransfer control disabled when policy is enabled but organization.useMyItems is false", () => {
      component.organization = { useMyItems: false } as Organization;
      component.policyResponse = new PolicyStatusResponse({
        organizationId: "org1",
        type: PolicyType.OrganizationDataOwnership,
        enabled: true,
        data: null,
      });

      component.ngOnInit();

      expect(component.data.controls.enableIndividualItemsTransfer.disabled).toBe(true);
    });

    it("should keep enableIndividualItemsTransfer control disabled when policy is enabled but organization is undefined", () => {
      component.organization = undefined;
      component.policyResponse = new PolicyStatusResponse({
        organizationId: "org1",
        type: PolicyType.OrganizationDataOwnership,
        enabled: true,
        data: null,
      });

      component.ngOnInit();

      expect(component.data.controls.enableIndividualItemsTransfer.disabled).toBe(true);
    });

    it("should enable enableIndividualItemsTransfer control when enabled changes to true and useMyItems is true", () => {
      component.organization = { useMyItems: true } as Organization;
      fixture.detectChanges();

      component.enabled.setValue(true);

      expect(component.data.controls.enableIndividualItemsTransfer.enabled).toBe(true);
    });

    it("should keep enableIndividualItemsTransfer control disabled when enabled changes to true but useMyItems is false", () => {
      component.organization = { useMyItems: false } as Organization;
      fixture.detectChanges();

      component.enabled.setValue(true);

      expect(component.data.controls.enableIndividualItemsTransfer.disabled).toBe(true);
    });
  });

  describe("buildRequestData", () => {
    it("should return enableIndividualItemsTransfer: false when useMyItems is false, even if control value is true", () => {
      component.organization = { useMyItems: false } as Organization;
      component.policyResponse = new PolicyStatusResponse({
        organizationId: "org1",
        type: PolicyType.OrganizationDataOwnership,
        enabled: true,
        data: { enableIndividualItemsTransfer: true },
      });

      component.ngOnInit();

      const result = component["buildRequestData"]();

      expect(result.enableIndividualItemsTransfer).toBe(false);
    });

    it("should return enableIndividualItemsTransfer: true when useMyItems is true and control value is true", () => {
      component.organization = { useMyItems: true } as Organization;
      component.policyResponse = new PolicyStatusResponse({
        organizationId: "org1",
        type: PolicyType.OrganizationDataOwnership,
        enabled: true,
        data: { enableIndividualItemsTransfer: true },
      });

      component.ngOnInit();

      const result = component["buildRequestData"]();

      expect(result.enableIndividualItemsTransfer).toBe(true);
    });
  });
});
