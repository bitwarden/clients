import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { BitErrorSummaryComponent } from "./error-summary.component";

@Component({
  selector: "test-host",
  imports: [BitErrorSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<bit-error-summary [formGroup]="formGroup" />`,
})
class TestHostComponent {
  readonly formGroup = new FormGroup({
    name: new FormControl("", Validators.required),
    email: new FormControl("", [Validators.required, Validators.email]),
  });
}

describe("BitErrorSummaryComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;

  const text = (): string => fixture.nativeElement.querySelector("bit-error-summary").textContent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({ fieldsNeedAttention: "__$1__ fields need attention" }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it("updates the error count as controls are touched", async () => {
    expect(text().trim()).toBe("");

    fixture.componentInstance.formGroup.markAllAsTouched();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(text()).toContain("2 fields need attention");
  });
});
