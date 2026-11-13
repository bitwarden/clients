import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { CheckboxComponent } from "../checkbox/checkbox.component";
import { I18nMockService } from "../utils/i18n-mock.service";

import { FormControlModule } from "./form-control.module";

@Component({
  selector: "test-host",
  imports: [ReactiveFormsModule, FormControlModule, CheckboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="formObj">
      <bit-form-control>
        <input type="checkbox" bitCheckbox formControlName="accept" />
        <bit-label>Accept terms</bit-label>
      </bit-form-control>
    </form>
  `,
})
class TestHostComponent {
  readonly formObj = new FormGroup({
    accept: new FormControl(false, Validators.requiredTrue),
  });
}

describe("FormControlComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let control: FormControl<boolean | null>;

  const errorText = () => fixture.nativeElement.querySelector(".tw-text-danger")?.textContent;
  const label = (): HTMLLabelElement => fixture.nativeElement.querySelector("label");

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({ required: "required", inputRequired: "required" }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    control = fixture.componentInstance.formObj.controls.accept;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it("shows the error once the control is touched", async () => {
    expect(errorText()).toBeUndefined();

    control.markAsTouched();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(errorText()).toContain("required");
  });

  it("reflects the disabled state when the control is disabled", async () => {
    expect(label().classList).toContain("tw-cursor-pointer");

    control.disable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(label().classList).toContain("tw-cursor-auto");
  });
});
