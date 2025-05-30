import { CommonModule } from "@angular/common";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  HelpUsersUpdatePasswordsPolicy,
  HelpUsersUpdatePasswordsComponent,
} from "./help-users-update-passwords.component";

describe("HelpUsersUpdatePasswordsPolicy", () => {
  const policy = new HelpUsersUpdatePasswordsPolicy();

  it("has the correct attributes", () => {
    expect(policy.name).toEqual("helpUsersUpdatePasswordsTitle");
    expect(policy.description).toEqual("helpUsersUpdatePasswordsDesc");
    expect(policy.type).toEqual(PolicyType.HelpUsersUpdatePasswords);
    expect(policy.component).toEqual(HelpUsersUpdatePasswordsComponent);
  });
});

describe("HelpUsersUpdatePasswordsComponent", () => {
  let component: HelpUsersUpdatePasswordsComponent;
  let fixture: ComponentFixture<HelpUsersUpdatePasswordsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, ReactiveFormsModule, I18nPipe],
      declarations: [HelpUsersUpdatePasswordsComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(HelpUsersUpdatePasswordsComponent);
    component = fixture.componentInstance;
  });

  it("input selected on load when policy enabled", async () => {
    component.policyResponse = new PolicyResponse({
      id: "policy-1",
      organizationId: "org-1",
      type: PolicyType.HelpUsersUpdatePasswords,
      enabled: true,
    });

    component.ngOnInit();
    fixture.detectChanges();

    expect(component.enabled.value).toBe(true);

    const checkboxElement = fixture.debugElement.query(By.css("input[type='checkbox']"));

    expect(checkboxElement.nativeElement.checked).toBe(true);
  });

  it("input not selected on load when policy disabled", async () => {
    component.policyResponse = new PolicyResponse({
      id: "policy-1",
      organizationId: "org-1",
      type: PolicyType.HelpUsersUpdatePasswords,
      enabled: false,
    });

    component.ngOnInit();
    fixture.detectChanges();

    const checkboxElement = fixture.debugElement.query(By.css("input[type='checkbox']"));

    expect(checkboxElement.nativeElement.checked).toBe(false);
  });
});
