import { LiveAnnouncer } from "@angular/cdk/a11y";
import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitHintDirective } from "../form-control/hint.directive";
import { BitLabelComponent } from "../form-control/label.component";
import { I18nMockService } from "../utils/i18n-mock.service";

import { DropzoneComponent } from "./dropzone.component";
import { FileDropzoneComponent } from "./file-dropzone.component";
import { FileListComponent } from "./file-list.component";

const makeFile = (name = "a.txt") => new File(["x"], name);

const i18nProvider = {
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
      loading: "Loading",
      required: "required",
    }),
};

// TODO: Fix this the next time the file is edited.
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "test-host",
  imports: [FileDropzoneComponent, BitLabelComponent, ReactiveFormsModule],
  template: `
    <bit-file-dropzone [multiple]="multiple" [disabled]="disabled" [formControl]="file">
      <bit-label>Upload</bit-label>
    </bit-file-dropzone>
  `,
})
class TestHostComponent {
  multiple = false;
  disabled = false;
  file = new FormControl<File[]>([], { nonNullable: true });
  get files(): File[] {
    return this.file.value;
  }
  set files(value: File[]) {
    this.file.setValue(value);
  }
  showError(message = "boom"): void {
    this.file.setErrors({ custom: { message } });
    this.file.markAsTouched();
  }
  clearError(): void {
    this.file.setErrors(null);
  }
}

// TODO: Fix this the next time the file is edited.
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "hint-host",
  imports: [FileDropzoneComponent, BitLabelComponent, BitHintDirective, ReactiveFormsModule],
  template: `
    <bit-file-dropzone [formControl]="file">
      <bit-label>Upload</bit-label>
      <bit-hint>Pick files</bit-hint>
    </bit-file-dropzone>
  `,
})
class HintHostComponent {
  file = new FormControl<File[]>([], { nonNullable: true });
  showError(message = "boom"): void {
    this.file.setErrors({ custom: { message } });
    this.file.markAsTouched();
  }
}

// TODO: Fix this the next time the file is edited.
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "form-host",
  imports: [FileDropzoneComponent, BitLabelComponent, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <bit-file-dropzone formControlName="upload">
        <bit-label>Upload</bit-label>
      </bit-file-dropzone>
    </form>
  `,
})
class FormHostComponent {
  form = new FormGroup({
    upload: new FormControl<File[]>([], { nonNullable: true }),
  });
}

// TODO: Fix this the next time the file is edited.
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "multi-form-host",
  imports: [FileDropzoneComponent, BitLabelComponent, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <bit-file-dropzone formControlName="upload" multiple>
        <bit-label>Upload</bit-label>
      </bit-file-dropzone>
    </form>
  `,
})
class MultiFormHostComponent {
  form = new FormGroup({
    upload: new FormControl<File[]>([], { nonNullable: true }),
  });
}

// TODO: Fix this the next time the file is edited.
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "required-host",
  imports: [FileDropzoneComponent, BitLabelComponent, ReactiveFormsModule],
  template: `
    <bit-file-dropzone [formControl]="file">
      <bit-label>Upload</bit-label>
    </bit-file-dropzone>
  `,
})
class RequiredHostComponent {
  file = new FormControl<File[]>([], {
    nonNullable: true,
    validators: [Validators.required],
  });
}

describe("FileDropzoneComponent", () => {
  describe("rendering", () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostComponent);
      fixture.detectChanges();
    });

    it("renders the bit-dropzone child", () => {
      expect(fixture.debugElement.query(By.directive(DropzoneComponent))).toBeTruthy();
    });

    it("renders bit-form-field's label via projection", () => {
      const label = fixture.nativeElement.querySelector("label[for]") as HTMLLabelElement;
      expect(label).toBeTruthy();
      expect(label.textContent).toContain("Upload");
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
      fixture.detectChanges();
    });

    it("replaces the file list in single-file mode", () => {
      const a = makeFile("a.txt");
      const b = makeFile("b.txt");
      fixture.componentInstance.files = [a];
      fixture.detectChanges();

      emitFromDropzone([b]);

      expect(fixture.componentInstance.files).toEqual([b]);
    });

    it("appends to the file list in multiple mode", () => {
      fixture.componentInstance.multiple = true;
      const a = makeFile("a.txt");
      const b = makeFile("b.txt");
      const c = makeFile("c.txt");
      fixture.componentInstance.files = [a];
      fixture.detectChanges();

      emitFromDropzone([b, c]);

      expect(fixture.componentInstance.files).toEqual([a, b, c]);
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
      const upload: FileDropzoneComponent = fixture.debugElement.query(
        By.directive(FileDropzoneComponent),
      ).componentInstance;
      const file = makeFile();

      upload.writeValue([file]);
      expect(upload.files()).toEqual([file]);

      upload.writeValue(null);
      expect(upload.files()).toEqual([]);
    });

    it("collapses an array passed to writeValue to the first file in single mode", () => {
      const upload: FileDropzoneComponent = fixture.debugElement.query(
        By.directive(FileDropzoneComponent),
      ).componentInstance;
      const a = makeFile("a.txt");
      const b = makeFile("b.txt");

      upload.writeValue([a, b]);

      expect(upload.files()).toEqual([a]);
    });

    it("pushes the selected file to the bound FormControl as a single-element array", () => {
      const file = makeFile();
      emitFromDropzone([file]);

      expect(fixture.componentInstance.form.controls.upload.value).toEqual([file]);
    });

    it("pushes an empty array to the FormControl when the last file is removed", () => {
      const file = makeFile();
      emitFromDropzone([file]);

      const list: FileListComponent = fixture.debugElement.query(
        By.directive(FileListComponent),
      ).componentInstance;
      list.fileRemoved.emit(file);
      fixture.detectChanges();

      expect(fixture.componentInstance.form.controls.upload.value).toEqual([]);
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

  describe("ControlValueAccessor (multiple)", () => {
    let fixture: ComponentFixture<MultiFormHostComponent>;

    const emitFromDropzone = (files: File[]) => {
      const dropzone: DropzoneComponent = fixture.debugElement.query(
        By.directive(DropzoneComponent),
      ).componentInstance;
      dropzone.filesSelected.emit(files);
      fixture.detectChanges();
    };

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [MultiFormHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(MultiFormHostComponent);
      fixture.detectChanges();
    });

    it("populates files from writeValue with an array", () => {
      const upload: FileDropzoneComponent = fixture.debugElement.query(
        By.directive(FileDropzoneComponent),
      ).componentInstance;
      const a = makeFile("a.txt");
      const b = makeFile("b.txt");

      upload.writeValue([a, b]);

      expect(upload.files()).toEqual([a, b]);
    });

    it("pushes the full File[] to the bound FormControl when files are selected", () => {
      const a = makeFile("a.txt");
      const b = makeFile("b.txt");

      emitFromDropzone([a, b]);

      expect(fixture.componentInstance.form.controls.upload.value).toEqual([a, b]);
    });

    it("pushes the updated File[] to the FormControl when a file is removed", () => {
      const a = makeFile("a.txt");
      const b = makeFile("b.txt");
      emitFromDropzone([a, b]);

      const list: FileListComponent = fixture.debugElement.query(
        By.directive(FileListComponent),
      ).componentInstance;
      list.fileRemoved.emit(a);
      fixture.detectChanges();

      expect(fixture.componentInstance.form.controls.upload.value).toEqual([b]);
    });

    it("pushes an empty array (not null) when the last file is removed", () => {
      const file = makeFile();
      emitFromDropzone([file]);

      const list: FileListComponent = fixture.debugElement.query(
        By.directive(FileListComponent),
      ).componentInstance;
      list.fileRemoved.emit(file);
      fixture.detectChanges();

      expect(fixture.componentInstance.form.controls.upload.value).toEqual([]);
    });
  });

  describe("bit-form-field integration", () => {
    let fixture: ComponentFixture<HintHostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [HintHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(HintHostComponent);
      fixture.detectChanges();
    });

    it("projects bit-hint into bit-form-field when no error is present", () => {
      const hint = fixture.nativeElement.querySelector("bit-hint") as HTMLElement;
      expect(hint).toBeTruthy();
      expect(hint.textContent).toContain("Pick files");
    });

    it("renders bit-error from the FormControl when it becomes invalid and touched", () => {
      fixture.componentInstance.showError("File is too large");
      fixture.detectChanges();

      const error = fixture.nativeElement.querySelector("bit-error") as HTMLElement;
      expect(error).toBeTruthy();
      expect(error.textContent).toContain("File is too large");
    });

    it("associates the bit-form-field label with the dropzone's file input", () => {
      const label = fixture.nativeElement.querySelector("label[for]") as HTMLLabelElement;
      const fileInput = fixture.nativeElement.querySelector(
        'bit-dropzone input[type="file"]',
      ) as HTMLInputElement;

      expect(label.htmlFor).toBeTruthy();
      expect(label.htmlFor).toBe(fileInput.id);
    });
  });

  describe("required indicator", () => {
    it("renders the * indicator when the FormControl has Validators.required", async () => {
      await TestBed.configureTestingModule({
        imports: [RequiredHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      const fixture = TestBed.createComponent(RequiredHostComponent);
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector("label[for]") as HTMLLabelElement;
      expect(label.textContent).toContain("*");
    });
  });

  describe("touched state via blur", () => {
    let fixture: ComponentFixture<FormHostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [FormHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(FormHostComponent);
      fixture.detectChanges();
    });

    it("marks the bound FormControl as touched when the dropzone input loses focus", () => {
      const control = fixture.componentInstance.form.controls.upload;
      expect(control.touched).toBe(false);

      const dropzone: DropzoneComponent = fixture.debugElement.query(
        By.directive(DropzoneComponent),
      ).componentInstance;
      dropzone.blurred.emit();
      fixture.detectChanges();

      expect(control.touched).toBe(true);
    });
  });

  describe("accessibility announcements", () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let announceSpy: jest.SpyInstance;

    const dropzone = () =>
      fixture.debugElement.query(By.directive(DropzoneComponent))
        .componentInstance as DropzoneComponent;

    const fileList = () =>
      fixture.debugElement.query(By.directive(FileListComponent))
        ?.componentInstance as FileListComponent;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostComponent);
      fixture.componentInstance.multiple = true;
      fixture.detectChanges();
      announceSpy = jest.spyOn(TestBed.inject(LiveAnnouncer), "announce").mockResolvedValue();
    });

    it("does not announce anything on initial render", () => {
      expect(announceSpy).not.toHaveBeenCalled();
    });

    it("announces a single-file add with the filename (assertive politeness)", () => {
      dropzone().filesSelected.emit([makeFile("a.txt")]);

      expect(announceSpy).toHaveBeenCalledWith("File added: a.txt", "assertive");
    });

    it("announces a multi-file add with count and joined filenames", () => {
      dropzone().filesSelected.emit([makeFile("a.txt"), makeFile("b.txt"), makeFile("c.txt")]);

      expect(announceSpy).toHaveBeenCalledWith("3 files added: a.txt, b.txt, c.txt", "assertive");
    });

    it("announces a removal with the filename", () => {
      const a = makeFile("a.txt");
      fixture.componentInstance.files = [a];
      fixture.detectChanges();
      announceSpy.mockClear();

      fileList().fileRemoved.emit(a);

      expect(announceSpy).toHaveBeenCalledWith("File removed: a.txt", "assertive");
    });

    it("does not announce when files are set via writeValue", () => {
      const upload: FileDropzoneComponent = fixture.debugElement.query(
        By.directive(FileDropzoneComponent),
      ).componentInstance;

      upload.writeValue([makeFile("a.txt")]);
      fixture.detectChanges();

      expect(announceSpy).not.toHaveBeenCalled();
    });
  });

  describe("focus-time file count announcement", () => {
    let fixture: ComponentFixture<TestHostComponent>;

    const dropzoneInput = () =>
      fixture.nativeElement.querySelector('bit-dropzone input[type="file"]') as HTMLInputElement;

    const filesUploadedSpan = () => {
      const input = dropzoneInput();
      const id = `${input.id}-files-uploaded`;
      return fixture.nativeElement.querySelector(`#${id}`) as HTMLElement | null;
    };

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostComponent);
      fixture.componentInstance.multiple = true;
      fixture.detectChanges();
    });

    it("renders an empty status span and omits its id from aria-describedby when no files are attached", () => {
      const input = dropzoneInput();
      const span = filesUploadedSpan();

      expect(span).toBeTruthy();
      expect(span!.textContent?.trim()).toBe("");
      expect(input.getAttribute("aria-describedby") ?? "").not.toContain(span!.id);
    });

    it("announces a single file as '1 file uploaded' via aria-describedby", () => {
      fixture.componentInstance.files = [makeFile("a.txt")];
      fixture.detectChanges();

      const input = dropzoneInput();
      const span = filesUploadedSpan()!;

      expect(span.textContent?.trim()).toBe("1 file uploaded");
      expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(span.id);
    });

    it("announces multiple files with count via aria-describedby", () => {
      fixture.componentInstance.files = [makeFile("a.txt"), makeFile("b.txt"), makeFile("c.txt")];
      fixture.detectChanges();

      const input = dropzoneInput();
      const span = filesUploadedSpan()!;

      expect(span.textContent?.trim()).toBe("3 files uploaded");
      expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(span.id);
    });
  });

  describe("focus management after removal", () => {
    let fixture: ComponentFixture<TestHostComponent>;

    const fileList = () =>
      fixture.debugElement.query(By.directive(FileListComponent))
        ?.componentInstance as FileListComponent;

    const deleteButtons = () =>
      Array.from(
        fixture.nativeElement.querySelectorAll(
          "bit-file-list button[bitIconButton]",
        ) as NodeListOf<HTMLButtonElement>,
      );

    const dropzoneInput = () =>
      fixture.nativeElement.querySelector('bit-dropzone input[type="file"]') as HTMLInputElement;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostComponent);
      fixture.componentInstance.multiple = true;
    });

    it("focuses the delete button at the removed index when a middle file is removed", () => {
      const a = makeFile("a.txt");
      const b = makeFile("b.txt");
      const c = makeFile("c.txt");
      fixture.componentInstance.files = [a, b, c];
      fixture.detectChanges();

      fileList().fileRemoved.emit(b);
      fixture.detectChanges();

      const buttons = deleteButtons();
      expect(buttons.length).toBe(2);
      expect(document.activeElement).toBe(buttons[1]);
    });

    it("clamps to the last delete button when the last file is removed", () => {
      const a = makeFile("a.txt");
      const b = makeFile("b.txt");
      fixture.componentInstance.files = [a, b];
      fixture.detectChanges();

      fileList().fileRemoved.emit(b);
      fixture.detectChanges();

      const buttons = deleteButtons();
      expect(buttons.length).toBe(1);
      expect(document.activeElement).toBe(buttons[0]);
    });

    it("focuses the dropzone's file input when the last remaining file is removed", () => {
      const a = makeFile("a.txt");
      fixture.componentInstance.files = [a];
      fixture.detectChanges();

      fileList().fileRemoved.emit(a);
      fixture.detectChanges();

      expect(document.activeElement).toBe(dropzoneInput());
    });

    it("is a no-op for focus when the removed file is not present in the list", () => {
      const a = makeFile("a.txt");
      fixture.componentInstance.files = [a];
      fixture.detectChanges();

      const before = document.activeElement;
      fileList().fileRemoved.emit(makeFile("ghost.txt"));
      fixture.detectChanges();

      expect(document.activeElement).toBe(before);
    });
  });
});
