import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitHintDirective } from "../form-control/hint.directive";
import { BitLabelComponent } from "../form-control/label.component";
import { I18nMockService } from "../utils/i18n-mock.service";

import { FileUploadComponent } from "./file-upload.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-file-upload [formControl]="control" [accept]="accept">
      <bit-label>Upload file</bit-label>
      <bit-hint>hint text</bit-hint>
    </bit-file-upload>
  `,
  imports: [FileUploadComponent, BitLabelComponent, BitHintDirective, ReactiveFormsModule],
})
class HostComponent {
  control = new FormControl<File[]>([], { nonNullable: true });
  accept = "";
}

const makeFile = (name = "a.txt") => new File(["x"], name);

function selectFile(fixture: ComponentFixture<HostComponent>, file: File): void {
  const input = fixture.debugElement.query(By.css('input[type="file"]')).nativeElement;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new Event("change"));
  fixture.detectChanges();
}

describe("FileUploadComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              chooseFile: "Choose File",
              noFileSelected: "No file selected",
              fileChosen: "File chosen __$1__",
              required: "required",
              inputRequired: "Input is required.",
            }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("shows the placeholder when no file is selected", () => {
    expect(fixture.nativeElement.textContent).toContain("No file selected");
  });

  it("writes the control value into the filename readout", () => {
    host.control.setValue([makeFile("report.pdf")]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("report.pdf");
  });

  it("displays only the first file when the control holds several", () => {
    host.control.setValue([makeFile("first.txt"), makeFile("second.txt")]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("first.txt");
    expect(fixture.nativeElement.textContent).not.toContain("second.txt");
  });

  it("updates the control when a file is selected", () => {
    selectFile(fixture, makeFile("chosen.txt"));

    expect(host.control.value.map((f) => f.name)).toEqual(["chosen.txt"]);
    expect(fixture.nativeElement.textContent).toContain("chosen.txt");
  });

  it("associates the label with the choose-file button", () => {
    const label = fixture.debugElement.query(By.css("label")).nativeElement;
    const button = fixture.debugElement.query(By.css("button")).nativeElement;

    expect(label.getAttribute("for")).toBe(button.id);
    expect(button.id).toBeTruthy();
  });

  it("renders the required indicator when the control is required", () => {
    host.control.addValidators(Validators.required);
    host.control.updateValueAndValidity();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css("sup"))).not.toBeNull();
  });

  it("shows an error once the required control is touched", () => {
    host.control.addValidators(Validators.required);
    host.control.updateValueAndValidity();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css("bit-error"))).toBeNull();

    host.control.markAsTouched();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css("bit-error"))).not.toBeNull();
  });

  it("disables the native input when the control is disabled", () => {
    host.control.disable();
    fixture.detectChanges();

    const input = fixture.debugElement.query(By.css('input[type="file"]')).nativeElement;
    expect(input.disabled).toBe(true);
  });
});
