import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";

import {
  PasswordColorText,
  PasswordStrengthScore,
  PasswordStrengthV2Component,
} from "./password-strength-v2.component";

describe("PasswordStrengthV2Component", () => {
  let component: PasswordStrengthV2Component;
  let fixture: ComponentFixture<PasswordStrengthV2Component>;

  const mockPasswordStrengthService = mock<PasswordStrengthServiceAbstraction>();
  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: PasswordStrengthServiceAbstraction, useValue: mockPasswordStrengthService },
      ],
    });
    fixture = TestBed.createComponent(PasswordStrengthV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create the component", () => {
    expect(component).toBeTruthy();
  });

  it("should update password strength when password changes", () => {
    const password = "testPassword";
    jest.spyOn(component, "updatePasswordStrength");
    component.password = password;
    expect(component.updatePasswordStrength).toHaveBeenCalledWith(password);
    expect(mockPasswordStrengthService.getPasswordStrength).toHaveBeenCalledWith(
      password,
      undefined,
      undefined,
    );
  });

  it("should emit password strength result when password changes", () => {
    const password = "testPassword";
    jest.spyOn(component.passwordStrengthScore, "emit");
    component.password = password;
    expect(component.passwordStrengthScore.emit).toHaveBeenCalled();
  });

  it("should emit password score text and color when ngOnChanges executes", () => {
    jest.spyOn(component.passwordScoreTextWithColor, "emit");
    jest.useFakeTimers();
    component.ngOnChanges();
    jest.runAllTimers();
    expect(component.passwordScoreTextWithColor.emit).toHaveBeenCalled();
  });

  const table = [
    [4, { color: "success", text: "strong" }],
    [3, { color: "primary", text: "good" }],
    [2, { color: "warning", text: "weak" }],
    [1, { color: "danger", text: "weak" }],
    [null, { color: "danger", text: null }],
  ];

  test.each(table)(
    "should passwordScore be %d then emit passwordScoreTextWithColor = %s",
    (score: PasswordStrengthScore, expected: PasswordColorText) => {
      jest.useFakeTimers();
      jest.spyOn(component.passwordScoreTextWithColor, "emit");
      component.passwordScore = score;
      component.ngOnChanges();
      jest.runAllTimers();
      expect(component.passwordScoreTextWithColor.emit).toHaveBeenCalledWith(expected);
    },
  );
});
