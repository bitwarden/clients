import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitHintDirective } from "../form-control/hint.directive";
import { BitLabelComponent } from "../form-control/label.component";
import { I18nMockService } from "../utils/i18n-mock.service";

import { FileDropzoneComponent } from "./file-dropzone.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-file-dropzone
      [formControl]="control"
      [multiple]="multiple()"
      [maxFileSize]="maxFileSize()"
    >
      <bit-label>Upload files</bit-label>
      <bit-hint>hint text</bit-hint>
    </bit-file-dropzone>
  `,
  imports: [FileDropzoneComponent, BitLabelComponent, BitHintDirective, ReactiveFormsModule],
})
class HostComponent {
  control = new FormControl<File[]>([], { nonNullable: true });
  readonly multiple = signal(false);
  readonly maxFileSize = signal<number | undefined>(undefined);
}

const makeFile = (name = "a.txt") => new File(["x"], name);

function selectFiles(fixture: ComponentFixture<HostComponent>, files: File[]): void {
  const input = fixture.debugElement.query(By.css('input[type="file"]')).nativeElement;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  input.dispatchEvent(new Event("change"));
  fixture.detectChanges();
}

describe("FileDropzoneComponent", () => {
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
              maxFileSizeParam: "Max. File Size: __$1__MB",
              chooseFiles: "Choose files",
              clickToUploadOrDragAndDrop: "Click to upload or drag and drop",
              fileAdded: "File added: __$1__",
              filesAdded: "__$1__ files added: __$2__",
              fileRemoved: "File removed: __$1__",
              oneFileUploaded: "1 file uploaded",
              filesUploaded: "__$1__ files uploaded",
              uploadedFiles: "Uploaded files",
              delete: "Delete",
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

  it("shows the drop prompt", () => {
    expect(fixture.nativeElement.textContent).toContain("Click to upload or drag and drop");
  });

  it("shows the max file size hint when provided", () => {
    host.maxFileSize.set(30);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("Max. File Size: 30MB");
  });

  it("keeps only the first file in single mode", () => {
    selectFiles(fixture, [makeFile("a.txt"), makeFile("b.txt")]);

    expect(host.control.value.map((f) => f.name)).toEqual(["a.txt"]);
  });

  it("accumulates files in multiple mode", () => {
    host.multiple.set(true);
    fixture.detectChanges();

    selectFiles(fixture, [makeFile("a.txt")]);
    selectFiles(fixture, [makeFile("b.txt"), makeFile("c.txt")]);

    expect(host.control.value.map((f) => f.name)).toEqual(["a.txt", "b.txt", "c.txt"]);
  });

  it("renders a list entry with a delete button per file", () => {
    host.multiple.set(true);
    fixture.detectChanges();
    selectFiles(fixture, [makeFile("a.txt"), makeFile("b.txt")]);

    const items = fixture.debugElement.queryAll(By.css("li"));
    expect(items.length).toBe(2);
  });

  it("removes a file when its delete button is clicked", () => {
    host.multiple.set(true);
    fixture.detectChanges();
    selectFiles(fixture, [makeFile("a.txt"), makeFile("b.txt")]);

    const firstDelete = fixture.debugElement.query(By.css("li button")).nativeElement;
    firstDelete.click();
    fixture.detectChanges();

    expect(host.control.value.map((f) => f.name)).toEqual(["b.txt"]);
  });

  it("associates the label with the native file input", () => {
    const label = fixture.debugElement.query(By.css("bit-form-field label")).nativeElement;
    const input = fixture.debugElement.query(By.css('input[type="file"]')).nativeElement;

    expect(label.getAttribute("for")).toBe(input.id);
    expect(input.id).toBeTruthy();
  });

  it("shows an error once a required control is touched", () => {
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
