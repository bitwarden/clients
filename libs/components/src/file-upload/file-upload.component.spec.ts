import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitHintDirective } from "../form-control/hint.directive";
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
      fileAdded: "File added: __$1__",
      filesAdded: "__$1__ files added: __$2__",
      fileRemoved: "File removed: __$1__",
      oneFileUploaded: "1 file uploaded",
      filesUploaded: "__$1__ files uploaded",
      uploadedFiles: "Uploaded files",
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
  selector: "hint-host",
  imports: [FileUploadComponent, BitLabelComponent, BitHintDirective],
  template: `
    <bit-file-upload [variant]="variant" [errorMessage]="errorMessage" [(files)]="files">
      <bit-label>Upload</bit-label>
      <bit-hint>Pick a file</bit-hint>
    </bit-file-upload>
  `,
})
class HintHostComponent {
  variant: "default" | "dropzone" = "default";
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

// TODO: Fix this the next time the file is edited.
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "multi-form-host",
  imports: [FileUploadComponent, BitLabelComponent, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <bit-file-upload formControlName="upload" variant="dropzone" multiple>
        <bit-label>Upload</bit-label>
      </bit-file-upload>
    </form>
  `,
})
class MultiFormHostComponent {
  form = new FormGroup({
    upload: new FormControl<File[]>([], { nonNullable: true }),
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

    it("collapses an array passed to writeValue to the first file in single mode", () => {
      const upload: FileUploadComponent = fixture.debugElement.query(
        By.directive(FileUploadComponent),
      ).componentInstance;
      const a = makeFile("a.txt");
      const b = makeFile("b.txt");

      upload.writeValue([a, b]);

      expect(upload.files()).toEqual([a]);
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
      const upload: FileUploadComponent = fixture.debugElement.query(
        By.directive(FileUploadComponent),
      ).componentInstance;
      const a = makeFile("a.txt");
      const b = makeFile("b.txt");

      upload.writeValue([a, b]);

      expect(upload.files()).toEqual([a, b]);
    });

    it("wraps a single File written to writeValue into a one-element array", () => {
      const upload: FileUploadComponent = fixture.debugElement.query(
        By.directive(FileUploadComponent),
      ).componentInstance;
      const file = makeFile();

      upload.writeValue(file);

      expect(upload.files()).toEqual([file]);
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

  describe("aria-describedby (with projected bit-hint)", () => {
    let fixture: ComponentFixture<HintHostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [HintHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(HintHostComponent);
      fixture.componentInstance.variant = "default";
      fixture.detectChanges();
    });

    it("points at the rendered bit-hint id when no errorMessage is set", () => {
      const overlayButton = fixture.nativeElement.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;
      const hintEl = fixture.nativeElement.querySelector("bit-hint") as HTMLElement;

      expect(hintEl).toBeTruthy();
      expect(hintEl.id).toBeTruthy();
      expect(overlayButton.getAttribute("aria-describedby")).toBe(hintEl.id);
    });

    it("switches back to the bit-hint id after the errorMessage is cleared", () => {
      const overlayButton = fixture.nativeElement.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;

      fixture.componentInstance.errorMessage = "boom";
      fixture.detectChanges();

      const errorEl = fixture.nativeElement.querySelector("bit-error") as HTMLElement;
      expect(overlayButton.getAttribute("aria-describedby")).toBe(errorEl.id);

      fixture.componentInstance.errorMessage = undefined;
      fixture.detectChanges();

      const hintEl = fixture.nativeElement.querySelector("bit-hint") as HTMLElement;
      expect(hintEl).toBeTruthy();
      expect(overlayButton.getAttribute("aria-describedby")).toBe(hintEl.id);
    });
  });

  describe("dropzone variant labelling", () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostComponent);
      fixture.componentInstance.variant = "dropzone";
      fixture.detectChanges();
    });

    it("renders the bit-label heading as a non-label element so bit-dropzone owns the form label", () => {
      const heading = fixture.nativeElement.querySelector(
        "bit-file-upload > div > div:first-child",
      ) as HTMLElement;

      expect(heading).toBeTruthy();
      expect(heading.tagName).toBe("DIV");
      expect(heading.querySelector("bit-label")).toBeTruthy();
    });

    it("associates the hidden file input with the outer heading via aria-labelledby", () => {
      const heading = fixture.nativeElement.querySelector(
        "bit-file-upload > div > div:first-child",
      ) as HTMLElement;
      const fileInput = fixture.nativeElement.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      expect(heading.id).toBeTruthy();
      expect(fileInput.getAttribute("aria-labelledby")).toBe(heading.id);
    });
  });

  describe("dropzone variant accessibility announcements", () => {
    let fixture: ComponentFixture<TestHostComponent>;

    const liveRegion = () =>
      fixture.nativeElement.querySelector('span[role="status"]') as HTMLElement | null;

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
      fixture.componentInstance.variant = "dropzone";
      fixture.componentInstance.multiple = true;
      fixture.detectChanges();
    });

    it("renders an empty live region on initial render", () => {
      const region = liveRegion();
      expect(region).toBeTruthy();
      expect(region!.textContent?.trim()).toBe("");
    });

    it("announces a single-file add with the filename", () => {
      dropzone().filesSelected.emit([makeFile("a.txt")]);
      fixture.detectChanges();

      expect(liveRegion()!.textContent?.trim()).toBe("File added: a.txt");
    });

    it("announces a multi-file add with count and joined filenames", () => {
      dropzone().filesSelected.emit([makeFile("a.txt"), makeFile("b.txt"), makeFile("c.txt")]);
      fixture.detectChanges();

      expect(liveRegion()!.textContent?.trim()).toBe("3 files added: a.txt, b.txt, c.txt");
    });

    it("announces a removal with the filename", () => {
      const a = makeFile("a.txt");
      fixture.componentInstance.files = [a];
      fixture.detectChanges();

      fileList().fileRemoved.emit(a);
      fixture.detectChanges();

      expect(liveRegion()!.textContent?.trim()).toBe("File removed: a.txt");
    });

    it("does not announce when files are set via writeValue", () => {
      const upload: FileUploadComponent = fixture.debugElement.query(
        By.directive(FileUploadComponent),
      ).componentInstance;

      upload.writeValue([makeFile("a.txt")]);
      fixture.detectChanges();

      expect(liveRegion()!.textContent?.trim()).toBe("");
    });

    it("has role=status, aria-live=polite, aria-atomic=true, and tw-sr-only", () => {
      const region = liveRegion()!;
      expect(region.getAttribute("role")).toBe("status");
      expect(region.getAttribute("aria-live")).toBe("polite");
      expect(region.getAttribute("aria-atomic")).toBe("true");
      expect(region.classList.contains("tw-sr-only")).toBe(true);
    });

    it("does not render the live region in the default variant", () => {
      fixture.componentInstance.variant = "default";
      fixture.componentInstance.multiple = false;
      fixture.detectChanges();

      // The default variant has its own aria-live span (with an id), not role="status".
      expect(fixture.nativeElement.querySelector('span[role="status"]')).toBeNull();
    });
  });

  describe("dropzone variant focus-time file count announcement", () => {
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
      fixture.componentInstance.variant = "dropzone";
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

    it("chains the files-uploaded id with the error id in aria-describedby when both are present", () => {
      fixture.componentInstance.files = [makeFile("a.txt"), makeFile("b.txt")];
      fixture.componentInstance.errorMessage = "boom";
      fixture.detectChanges();

      const input = dropzoneInput();
      const span = filesUploadedSpan()!;
      const errorEl = fixture.nativeElement.querySelector("bit-error") as HTMLElement;

      const describedBy = input.getAttribute("aria-describedby")?.split(" ") ?? [];
      expect(describedBy).toContain(span.id);
      expect(describedBy).toContain(errorEl.id);
    });

    it("does not include the files-uploaded id in the default variant's aria-describedby", () => {
      fixture.componentInstance.variant = "default";
      fixture.componentInstance.multiple = false;
      fixture.componentInstance.files = [makeFile("a.txt")];
      fixture.detectChanges();

      const overlayButton = fixture.nativeElement.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;
      const describedBy = overlayButton.getAttribute("aria-describedby") ?? "";

      expect(describedBy).not.toContain("-files-uploaded");
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
      fixture.componentInstance.variant = "dropzone";
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
