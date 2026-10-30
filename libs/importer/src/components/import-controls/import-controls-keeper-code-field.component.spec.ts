import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ImportControlsKeeperCodeFieldComponent } from "./import-controls-keeper-code-field.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ImportControlsKeeperCodeFieldComponent],
  template: `
    <ng-container [formGroup]="form">
      <importer-controls-keeper-code-field
        [canResend]="canResend()"
        (resend)="resends = resends + 1"
      />
    </ng-container>
  `,
})
class HostComponent {
  readonly canResend = signal(true);
  resends = 0;
  form = new FormGroup({ keeperCode: new FormControl("") });
}

describe("ImportControlsKeeperCodeFieldComponent", () => {
  let fixture: ComponentFixture<HostComponent>;

  const input = () =>
    fixture.nativeElement.querySelector("#importer-controls_input_keeper-code") as HTMLInputElement;
  const resendLink = () =>
    fixture.nativeElement.querySelector(
      "#importer-controls_button_keeper-resend-code",
    ) as HTMLButtonElement | null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it("binds the card's keeperCode control", () => {
    input().value = "123456";
    input().dispatchEvent(new Event("input"));

    expect(fixture.componentInstance.form.controls.keeperCode.value).toBe("123456");
  });

  it("offers Resend only when the prompt allows it", () => {
    expect(resendLink()).not.toBeNull();

    fixture.componentInstance.canResend.set(false);
    fixture.detectChanges();

    expect(resendLink()).toBeNull();
  });

  it("tells the card to resend, without taking focus from the field", () => {
    const mousedown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    resendLink()!.dispatchEvent(mousedown);
    resendLink()!.click();

    expect(mousedown.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.resends).toBe(1);
  });

  it("shows the card's required error on the field once it is touched", () => {
    const control = fixture.componentInstance.form.controls.keeperCode;
    control.setErrors({ keeperCodeRequired: { message: "verificationCodeRequired" } });
    control.markAsTouched();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("verificationCodeRequired");
  });
});
