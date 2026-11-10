import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, ReactiveFormsModule, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { InputModule } from "../input/input.module";
import { I18nMockService } from "../utils/i18n-mock.service";

import { FormFieldModule } from "./form-field.module";

@Component({
  selector: "test-host",
  imports: [FormFieldModule, InputModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-form-field>
      <bit-label>Name</bit-label>
      <input bitInput [formControl]="control" />
    </bit-form-field>
  `,
})
class TestHostComponent {
  readonly control = new FormControl("", [Validators.required, Validators.minLength(3)]);
}

describe("BitFormFieldComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;

  const errorText = (): string | undefined =>
    fixture.nativeElement.querySelector("bit-error")?.textContent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({
            required: "required",
            inputRequired: "Input is required.",
            inputMinLength: "Input must be at least __$1__ characters long.",
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it("updates the error message when the error changes while the field stays invalid", async () => {
    const control = fixture.componentInstance.control;
    control.markAsTouched();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(errorText()).toContain("Input is required.");

    control.setValue("ab");
    fixture.detectChanges();
    await fixture.whenStable();

    expect(errorText()).toContain("Input must be at least 3 characters long.");
  });
});
