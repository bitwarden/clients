import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitHintDirective } from "../form-control/hint.directive";
import { BitLabelComponent } from "../form-control/label.component";
import { I18nMockService } from "../utils/i18n-mock.service";

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
      noFileSelected: "No file selected",
      fileChosen: "File chosen __$1__",
      required: "required",
    }),
};

// TODO: Fix this the next time the file is edited.
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "test-host",
  imports: [FileUploadComponent, BitLabelComponent, ReactiveFormsModule],
  template: `
    <bit-file-upload [disabled]="disabled" [formControl]="file">
      <bit-label>Upload</bit-label>
    </bit-file-upload>
  `,
})
class TestHostComponent {
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
  imports: [FileUploadComponent, BitLabelComponent, BitHintDirective, ReactiveFormsModule],
  template: `
    <bit-file-upload [formControl]="file">
      <bit-label>Upload</bit-label>
      <bit-hint>Pick a file</bit-hint>
    </bit-file-upload>
  `,
})
class HintHostComponent {
  file = new FormControl<File[]>([], { nonNullable: true });
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
  selector: "form-host",
  imports: [FileUploadComponent, BitLabelComponent, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <bit-file-upload formControlName="upload">
        <bit-label>Upload</bit-label>
      </bit-file-upload>
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
  selector: "required-host",
  imports: [FileUploadComponent, BitLabelComponent, ReactiveFormsModule],
  template: `
    <bit-file-upload [formControl]="file">
      <bit-label>Upload</bit-label>
    </bit-file-upload>
  `,
})
class RequiredHostComponent {
  file = new FormControl<File[]>([], {
    nonNullable: true,
    validators: [Validators.required],
  });
}

// Mimics the WithError story: the FormControl is constructed with errors and marked
// touched BEFORE the component mounts (errors don't arrive via a later setErrors call).
// TODO: Fix this the next time the file is edited.
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "pre-errored-host",
  imports: [FileUploadComponent, BitLabelComponent, ReactiveFormsModule],
  template: `
    <bit-file-upload [formControl]="file">
      <bit-label>Upload</bit-label>
    </bit-file-upload>
  `,
})
class PreErroredHostComponent {
  file: FormControl<File[]>;
  constructor() {
    // Errors must come from a validator, not setErrors — Angular's setUpControl
    // calls updateValueAndValidity on mount which re-runs validators and overwrites
    // any errors set directly via setErrors.
    this.file = new FormControl<File[]>([], {
      nonNullable: true,
      validators: [() => ({ custom: { message: "File is too large" } })],
    });
    this.file.markAsTouched();
  }
}

describe("FileUploadComponent (inline)", () => {
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

    it("renders the 'Choose File' button via bit-form-field's prefix slot", () => {
      const button = fixture.nativeElement.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;

      expect(button).toBeTruthy();
      expect(button.textContent?.trim()).toBe("Choose File");
    });

    it("shows the 'No file selected' placeholder when nothing is selected", () => {
      const content = fixture.nativeElement.textContent ?? "";
      expect(content).toContain("No file selected");
    });

    it("renders bit-form-field's label via projection", () => {
      const label = fixture.nativeElement.querySelector("label") as HTMLLabelElement;
      expect(label).toBeTruthy();
      expect(label.textContent).toContain("Upload");
    });
  });

  describe("file selection via the file input", () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostComponent);
      fixture.detectChanges();
    });

    const dispatchFileChange = (files: File[]) => {
      const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(input, "files", { configurable: true, value: files });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      fixture.detectChanges();
    };

    it("collapses multiple incoming files to the first one", () => {
      const a = makeFile("a.txt");
      const b = makeFile("b.txt");
      dispatchFileChange([a, b]);
      expect(fixture.componentInstance.files).toEqual([a]);
    });

    it("replaces the prior selection on subsequent picks", () => {
      const a = makeFile("a.txt");
      const b = makeFile("b.txt");
      dispatchFileChange([a]);
      dispatchFileChange([b]);
      expect(fixture.componentInstance.files).toEqual([b]);
    });
  });

  describe("ControlValueAccessor", () => {
    let fixture: ComponentFixture<FormHostComponent>;

    const upload = () =>
      fixture.debugElement.query(By.directive(FileUploadComponent))
        .componentInstance as FileUploadComponent;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [FormHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(FormHostComponent);
      fixture.detectChanges();
    });

    it("populates files from writeValue and clears when written null", () => {
      const file = makeFile();
      upload().writeValue([file]);
      expect(upload().files()).toEqual([file]);

      upload().writeValue(null);
      expect(upload().files()).toEqual([]);
    });

    it("collapses an array passed to writeValue to the first file", () => {
      const a = makeFile("a.txt");
      const b = makeFile("b.txt");
      upload().writeValue([a, b]);
      expect(upload().files()).toEqual([a]);
    });

    it("disables the picker button when the FormControl is disabled", () => {
      fixture.componentInstance.form.controls.upload.disable();
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;
      expect(button.getAttribute("aria-disabled")).toBe("true");
    });
  });

  describe("openFilePicker", () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostComponent);
      fixture.detectChanges();
    });

    it("clears the hidden input's value before clicking it", () => {
      const fileInput = fixture.nativeElement.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const button = fixture.nativeElement.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;

      const clickSpy = jest.spyOn(fileInput, "click").mockImplementation(() => {
        expect(fileInput.value).toBe("");
      });

      button.click();

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it("marks the picker button as aria-disabled (not natively disabled) when disabled", () => {
      fixture.componentInstance.disabled = true;
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;

      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.hasAttribute("disabled")).toBe(false);
    });

    it("does not open the file picker when clicked while disabled", () => {
      fixture.componentInstance.disabled = true;
      fixture.detectChanges();

      const fileInput = fixture.nativeElement.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const button = fixture.nativeElement.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;
      const clickSpy = jest.spyOn(fileInput, "click");

      button.click();

      expect(clickSpy).not.toHaveBeenCalled();
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
      expect(hint.textContent).toContain("Pick a file");
    });

    it("renders bit-error from the FormControl when it becomes invalid and touched", () => {
      fixture.componentInstance.showError("File is too large");
      fixture.detectChanges();

      const error = fixture.nativeElement.querySelector("bit-error") as HTMLElement;
      expect(error).toBeTruthy();
      expect(error.textContent).toContain("File is too large");
    });

    it("switches back to the hint after the FormControl error is cleared", () => {
      fixture.componentInstance.showError();
      fixture.detectChanges();

      fixture.componentInstance.clearError();
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector("bit-hint") as HTMLElement;
      expect(hint).toBeTruthy();
    });

    it("associates the rendered <label> with the 'Choose File' button via for/id", () => {
      const label = fixture.nativeElement.querySelector("label") as HTMLLabelElement;
      const button = fixture.nativeElement.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;

      expect(label.htmlFor).toBeTruthy();
      expect(label.htmlFor).toBe(button.id);
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

      const label = fixture.nativeElement.querySelector("label") as HTMLLabelElement;
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

    it("marks the bound FormControl as touched when the picker button loses focus", () => {
      const control = fixture.componentInstance.form.controls.upload;
      expect(control.touched).toBe(false);

      const button = fixture.nativeElement.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;
      button.dispatchEvent(new FocusEvent("blur"));
      fixture.detectChanges();

      expect(control.touched).toBe(true);
    });
  });

  describe("pre-errored control (storybook scenario)", () => {
    it("renders bit-error when the bound FormControl is constructed already invalid and touched", async () => {
      await TestBed.configureTestingModule({
        imports: [PreErroredHostComponent],
        providers: [i18nProvider],
      }).compileComponents();

      const fixture = TestBed.createComponent(PreErroredHostComponent);
      fixture.detectChanges();

      const error = fixture.nativeElement.querySelector("bit-error") as HTMLElement;
      expect(error).toBeTruthy();
      expect(error.textContent).toContain("File is too large");
    });
  });
});
