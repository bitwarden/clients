import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock } from "jest-mock-extended";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { KeyService } from "@bitwarden/key-management";

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
        { provide: PolicyApiServiceAbstraction, useValue: mock<PolicyApiServiceAbstraction>() },
        { provide: AccountService, useValue: mock<AccountService>() },
        { provide: KeyService, useValue: mock<KeyService>() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(vNextOrganizationDataOwnershipPolicyComponent);
    component = fixture.componentInstance;
  });

  describe("loadData with null server response", () => {
    it("should default enableIndividualItemsTransfer to false when data is null", () => {
      fixture.componentRef.setInput(
        "policyResponse",
        new PolicyStatusResponse({
          organizationId: "org1",
          type: PolicyType.OrganizationDataOwnership,
          enabled: true,
          data: null,
        }),
      );

      component.ngOnInit();

      expect(component.data.controls.enableIndividualItemsTransfer.value).toBe(false);
    });

    it("should default enableIndividualItemsTransfer to false when the attribute is null", () => {
      fixture.componentRef.setInput(
        "policyResponse",
        new PolicyStatusResponse({
          organizationId: "org1",
          type: PolicyType.OrganizationDataOwnership,
          enabled: true,
          data: { enableIndividualItemsTransfer: null },
        }),
      );

      component.ngOnInit();

      expect(component.data.controls.enableIndividualItemsTransfer.value).toBe(false);
    });
  });
});
