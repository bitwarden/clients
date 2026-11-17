import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ImportControlsKeeperMethodPickerComponent } from "./import-controls-keeper-method-picker.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ImportControlsKeeperMethodPickerComponent],
  template: `
    <ng-container [formGroup]="form">
      <importer-controls-keeper-method-picker
        controlName="method"
        labelKey="pickerLabel"
        idPrefix="test-picker-"
        [methods]="methods"
        [labelFn]="label"
      />
    </ng-container>
  `,
})
class HostComponent {
  methods = [1, 2, 3];
  form = new FormGroup({ method: new FormControl<number | null>(2) });
  label = (method: number) => `method${method}`;
}

describe("ImportControlsKeeperMethodPickerComponent", () => {
  let fixture: ComponentFixture<HostComponent>;

  const radio = (method: number) =>
    fixture.nativeElement.querySelector(`#test-picker-${method}-input`) as HTMLInputElement;

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

  it("draws one radio per method with the id prefix followed by the method", () => {
    expect([1, 2, 3].map((method) => radio(method) != null)).toEqual([true, true, true]);
    expect(fixture.nativeElement.textContent).toContain("pickerLabel");
    expect(fixture.nativeElement.textContent).toContain("method1");
    expect(fixture.nativeElement.textContent).toContain("method3");
  });

  it("shows the card's control value as the chosen radio", () => {
    expect(radio(2).checked).toBe(true);
    expect(radio(1).checked).toBe(false);
  });

  it("writes the user's choice back to the card's control", () => {
    radio(3).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.method.value).toBe(3);
  });

  it("locks the radios while the card's control is disabled", () => {
    fixture.componentInstance.form.controls.method.disable();
    fixture.detectChanges();

    expect(radio(1).disabled).toBe(true);
    expect(radio(3).disabled).toBe(true);
  });
});
