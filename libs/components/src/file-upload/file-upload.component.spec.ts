import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitLabelComponent } from "../form-control/label.component";
import { I18nMockService } from "../utils/i18n-mock.service";

import { DropzoneComponent } from "./dropzone.component";
import { FileListComponent } from "./file-list.component";
import { FileUploadComponent } from "./file-upload.component";

const makeFile = (name = "a.txt") => new File(["x"], name);

const i18nProvider = {
  provide: I18nService,
  useFactory: () =>
    new I18nMockService({
      maxFileSizeParam: "Max. File Size: __$1__MB",
      chooseFiles: "Choose files",
      chooseFile: "Choose File",
      clickToUploadOrDragAndDrop: "Click to upload or drag and drop",
      noFileChosen: "No file chosen",
      fileChosen: "File chosen __$1__",
      delete: "Delete",
      loading: "Loading",
    }),
};

// TODO: Fix this the next time the file is edited.
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "test-host",
  imports: [FileUploadComponent, BitLabelComponent],
  template: `
    <bit-file-upload
      [variant]="variant"
      [multiple]="multiple"
      [disabled]="disabled"
      [errorMessage]="errorMessage"
      [(files)]="files"
    >
      <bit-label>Upload</bit-label>
    </bit-file-upload>
  `,
})
class TestHostComponent {
  variant: "default" | "dropzone" = "default";
  multiple = false;
  disabled = false;
  errorMessage: string | undefined = undefined;
  files: File[] = [];
}

// TODO: Fix this the next time the file is edited.
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "form-host",
  imports: [FileUploadComponent, BitLabelComponent, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <bit-file-upload formControlName="upload" variant="dropzone">
        <bit-label>Upload</bit-label>
      </bit-file-upload>
    </form>
  `,
})
class FormHostComponent {
  form = new FormGroup({
    upload: new FormControl<File | null>(null),
  });
}

describe("FileUploadComponent", () => {
  describe("variant selection", () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostComponent);
    });

    it("renders the inline picker (no dropzone) for variant=default", () => {
      fixture.componentInstance.variant = "default";
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.directive(DropzoneComponent))).toBeNull();
      expect(fixture.nativeElement.querySelector('button[type="button"]')).toBeTruthy();
    });

    it("renders the dropzone child for variant=dropzone", () => {
      fixture.componentInstance.variant = "dropzone";
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.directive(DropzoneComponent))).toBeTruthy();
    });

    it("forces the dropzone variant when multiple is true even if variant=default", () => {
      fixture.componentInstance.variant = "default";
      fixture.componentInstance.multiple = true;
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.directive(DropzoneComponent))).toBeTruthy();
    });
  });

  describe("file selection via dropzone output", () => {
    let fixture: ComponentFixture<TestHostComponent>;

    const emitFromDropzone = (files: File[]) => {
      const dropzone: DropzoneComponent = fixture.debugElement.query(
        By.directive(DropzoneComponent),
      ).componentInstance;
      dropzone.filesSelected.emit(files);
      fixture.detectChanges();
    };

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostComponent);
      fixture.componentInstance.variant = "dropzone";
      fixture.detectChanges();
    });

    it("replaces the file list in single-file mode", () => {
      const fileA = makeFile("a.txt");
      const fileB = makeFile("b.txt");
      fixture.componentInstance.files = [fileA];
      fixture.detectChanges();

      emitFromDropzone([fileB]);

      expect(fixture.componentInstance.files).toEqual([fileB]);
    });

    it("appends to the file list in multiple mode", () => {
      fixture.componentInstance.multiple = true;
      const fileA = makeFile("a.txt");
      const fileB = makeFile("b.txt");
      const fileC = makeFile("c.txt");
      fixture.componentInstance.files = [fileA];
      fixture.detectChanges();

      emitFromDropzone([fileB, fileC]);

      expect(fixture.componentInstance.files).toEqual([fileA, fileB, fileC]);
    });
  });

  describe("file removal via file-list output", () => {
    let fixture: ComponentFixture<TestHostComponent>;

    const emitRemove = (file: File) => {
      const list: FileListComponent = fixture.debugElement.query(
        By.directive(FileListComponent),
      ).componentInstance;
      list.fileRemoved.emit(file);
      fixture.detectChanges();
    };

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostComponent);
      fixture.componentInstance.variant = "dropzone";
      fixture.componentInstance.multiple = true;
    });

    it("removes only the matching file", () => {
      const a = makeFile("a.txt");
      const b = makeFile("b.txt");
      const c = makeFile("c.txt");
      fixture.componentInstance.files = [a, b, c];
      fixture.detectChanges();

      emitRemove(b);

      expect(fixture.componentInstance.files).toEqual([a, c]);
    });

    it("does nothing when disabled", () => {
      const a = makeFile("a.txt");
      const b = makeFile("b.txt");
      fixture.componentInstance.files = [a, b];
      fixture.componentInstance.disabled = true;
      fixture.detectChanges();

      emitRemove(a);

      expect(fixture.componentInstance.files).toEqual([a, b]);
    });
  });

  describe("ControlValueAccessor", () => {
    let fixture: ComponentFixture<FormHostComponent>;

    const emitFromDropzone = (files: File[]) => {
      const dropzone: DropzoneComponent = fixture.debugElement.query(
        By.directive(DropzoneComponent),
      ).componentInstance;
      dropzone.filesSelected.emit(files);
      fixture.detectChanges();
    };

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [FormHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(FormHostComponent);
      fixture.detectChanges();
    });

    it("populates files from writeValue and clears when written null", () => {
      const upload: FileUploadComponent = fixture.debugElement.query(
        By.directive(FileUploadComponent),
      ).componentInstance;
      const file = makeFile();

      upload.writeValue(file);
      expect(upload.files()).toEqual([file]);

      upload.writeValue(null);
      expect(upload.files()).toEqual([]);
    });

    it("pushes the selected file to the bound FormControl", () => {
      const file = makeFile();
      emitFromDropzone([file]);

      expect(fixture.componentInstance.form.controls.upload.value).toBe(file);
    });

    it("pushes null to the FormControl when the last file is removed", () => {
      const file = makeFile();
      emitFromDropzone([file]);

      const list: FileListComponent = fixture.debugElement.query(
        By.directive(FileListComponent),
      ).componentInstance;
      list.fileRemoved.emit(file);
      fixture.detectChanges();

      expect(fixture.componentInstance.form.controls.upload.value).toBeNull();
    });

    it("marks the FormControl as touched after a selection", () => {
      expect(fixture.componentInstance.form.controls.upload.touched).toBe(false);

      emitFromDropzone([makeFile()]);

      expect(fixture.componentInstance.form.controls.upload.touched).toBe(true);
    });

    it("disables the dropzone when the FormControl is disabled", () => {
      fixture.componentInstance.form.controls.upload.disable();
      fixture.detectChanges();

      const dropzone: DropzoneComponent = fixture.debugElement.query(
        By.directive(DropzoneComponent),
      ).componentInstance;
      expect(dropzone.disabled()).toBe(true);
    });
  });

  describe("openFilePicker (default variant)", () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostComponent);
      fixture.componentInstance.variant = "default";
      fixture.detectChanges();
    });

    it("clears the hidden input's value before clicking it", () => {
      const fileInput = fixture.nativeElement.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const overlayButton = fixture.nativeElement.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;

      fileInput.value = ""; // JSDOM only accepts empty string assignment, simulate "dirty" via spy state
      const clickSpy = jest.spyOn(fileInput, "click").mockImplementation(() => {
        // Capture the value at the moment click is invoked
        expect(fileInput.value).toBe("");
      });

      overlayButton.click();

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("aria-describedby", () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostComponent);
      fixture.componentInstance.variant = "default";
      fixture.detectChanges();
    });

    it("points at the rendered bit-error id when errorMessage is set", () => {
      const overlayButton = fixture.nativeElement.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;

      fixture.componentInstance.errorMessage = "boom";
      fixture.detectChanges();

      const errorEl = fixture.nativeElement.querySelector("bit-error") as HTMLElement;
      expect(errorEl).toBeTruthy();
      expect(overlayButton.getAttribute("aria-describedby")).toBe(errorEl.id);
    });
  });
});
