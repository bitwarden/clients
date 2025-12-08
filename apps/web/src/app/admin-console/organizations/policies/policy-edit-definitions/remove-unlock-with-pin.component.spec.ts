import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import {
  RemoveUnlockWithPinPolicy,
  RemoveUnlockWithPinPolicyComponent,
} from "./remove-unlock-with-pin.component";

describe("RemoveUnlockWithPinPolicy", () => {
  const policy = new RemoveUnlockWithPinPolicy();

  it("should have correct attributes", () => {
    expect(policy.name).toEqual("removeUnlockWithPinPolicyTitle");
    expect(policy.description).toEqual("removeUnlockWithPinPolicyDesc");
    expect(policy.type).toEqual(PolicyType.RemoveUnlockWithPin);
    expect(policy.component).toEqual(RemoveUnlockWithPinPolicyComponent);
  });
});

describe("RemoveUnlockWithPinPolicyComponent", () => {
  let component: RemoveUnlockWithPinPolicyComponent;
  let fixture: ComponentFixture<RemoveUnlockWithPinPolicyComponent>;
  const i18nService = mock<I18nService>();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: I18nService, useValue: i18nService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(RemoveUnlockWithPinPolicyComponent);
    component = fixture.componentInstance;
  });

  it("input selected on load when policy enabled", async () => {
    component.policyResponse = new PolicyResponse({
      id: "policy1",
      organizationId: "org1",
      type: PolicyType.RemoveUnlockWithPin,
      enabled: true,
    });

    component.ngOnInit();
    fixture.detectChanges();

    expect(component.enabled.value).toBe(true);
    const inputElement = fixture.debugElement.query(By.css("input"));
    expect(inputElement).not.toBeNull();
    expect(inputElement.properties).toMatchObject({
      id: "enabled",
      type: "checkbox",
      checked: true,
    });
  });

  it("input not selected on load when policy disabled", async () => {
    component.policyResponse = new PolicyResponse({
      id: "policy1",
      organizationId: "org1",
      type: PolicyType.RemoveUnlockWithPin,
      enabled: false,
    });

    component.ngOnInit();
    fixture.detectChanges();

    expect(component.enabled.value).toBe(false);
    const inputElement = fixture.debugElement.query(By.css("input"));
    expect(inputElement).not.toBeNull();
    expect(inputElement.properties).toMatchObject({
      id: "enabled",
      type: "checkbox",
      checked: false,
    });
  });

  it("turn on message label", async () => {
    component.policyResponse = new PolicyResponse({
      id: "policy1",
      organizationId: "org1",
      type: PolicyType.RemoveUnlockWithPin,
      enabled: false,
    });
    i18nService.t.mockReturnValue("Turn on");

    component.ngOnInit();
    fixture.detectChanges();

    const bitLabelElement = fixture.debugElement.query(By.css("bit-label"));
    expect(bitLabelElement).not.toBeNull();
    expect(bitLabelElement.nativeElement.textContent.trim()).toBe("Turn on");
  });
});
