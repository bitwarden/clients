import { FormControl, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitHintDirective } from "../form-control/hint.directive";
import { BitLabelComponent } from "../form-control/label.component";
import { I18nMockService } from "../utils/i18n-mock.service";

import { FileDropzoneComponent } from "./file-dropzone.component";

export default {
  title: "Component Library/Form/File Dropzone",
  component: FileDropzoneComponent,
  decorators: [
    moduleMetadata({
      imports: [
        FileDropzoneComponent,
        BitLabelComponent,
        BitHintDirective,
        FormsModule,
        ReactiveFormsModule,
      ],
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
    }),
  ],
  args: {
    maxFileSize: 30,
    multiple: false,
    accept: "",
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rKUVGKb7Kw3d6YGoQl6Ho7/Flowbite-Component-Mapping?node-id=42260-20194&m=dev",
    },
  },
} as Meta<FileDropzoneComponent>;

type Story = StoryObj<FileDropzoneComponent>;

function createErroredControl(message: string): FormControl<File[]> {
  // Errors must come from a validator, not setErrors. Angular's setUpControl
  // calls updateValueAndValidity on mount, which re-runs validators and
  // overwrites any errors set directly via setErrors.
  const control = new FormControl<File[]>([], {
    nonNullable: true,
    validators: [() => ({ custom: { message } })],
  });
  control.markAsTouched();
  return control;
}

function createMockFile(name: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type: "application/octet-stream" });
}

export const Default: Story = {
  render: (args) => ({
    props: { ...args, selectedFiles: [] as File[] },
    template: /*html*/ `
      <bit-file-dropzone
        [maxFileSize]="maxFileSize"
        [multiple]="multiple"
        [accept]="accept"
        [(ngModel)]="selectedFiles"
      >
        <bit-label>Upload file</bit-label>
        <bit-hint>SVG, PNG, JPG or GIF (MAX. 800x400px)</bit-hint>
      </bit-file-dropzone>
    `,
  }),
  args: {},
};

export const MultipleFiles: Story = {
  ...Default,
  args: {
    multiple: true,
  },
};

export const Required: Story = {
  render: (args) => ({
    props: {
      ...args,
      requiredControl: new FormControl<File[]>([], {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    template: /*html*/ `
      <bit-file-dropzone
        [maxFileSize]="maxFileSize"
        [multiple]="multiple"
        [accept]="accept"
        [formControl]="requiredControl"
      >
        <bit-label>Upload file</bit-label>
      </bit-file-dropzone>
    `,
  }),
  args: {},
};

export const Disabled: Story = {
  render: (args) => ({
    props: { ...args, selectedFiles: [] as File[] },
    template: /*html*/ `
      <bit-file-dropzone
        [maxFileSize]="maxFileSize"
        [multiple]="multiple"
        [accept]="accept"
        [(ngModel)]="selectedFiles"
        [disabled]="true"
      >
        <bit-label>Upload file</bit-label>
        <bit-hint>SVG, PNG, JPG or GIF (MAX. 800x400px)</bit-hint>
      </bit-file-dropzone>
    `,
  }),
  args: {},
};

export const WithError: Story = {
  render: (args) => ({
    props: { ...args, fileControl: createErroredControl("File is too large") },
    template: /*html*/ `
      <bit-file-dropzone
        [maxFileSize]="maxFileSize"
        [multiple]="multiple"
        [accept]="accept"
        [formControl]="fileControl"
      >
        <bit-label>Upload file</bit-label>
        <bit-hint>SVG, PNG, JPG or GIF (MAX. 800x400px)</bit-hint>
      </bit-file-dropzone>
    `,
  }),
  args: {},
};

export const LongFileNames: Story = {
  render: (args) => ({
    props: {
      ...args,
      selectedFiles: [
        createMockFile(
          "annual-report-2024-final-version-reviewed-and-approved-by-all-stakeholders.pdf",
          2_400_000,
        ),
        createMockFile("my-super-long-backup-archive-without-an-extension", 48_000_000),
        createMockFile("client-data-export-q4-2024-north-america-region-full-dataset.csv", 150_000),
      ],
    },
    template: /*html*/ `
      <bit-file-dropzone [maxFileSize]="maxFileSize" [multiple]="multiple" [(ngModel)]="selectedFiles">
        <bit-label>Upload files</bit-label>
      </bit-file-dropzone>
    `,
  }),
  args: {
    multiple: true,
  },
};

export const WithFiles: Story = {
  render: (args) => ({
    props: {
      ...args,
      selectedFiles: [
        createMockFile("image.png", 2_400_000),
        createMockFile("document.pdf", 150_000),
        createMockFile("archive.zip", 48_000_000),
      ],
    },
    template: /*html*/ `
      <bit-file-dropzone
        [maxFileSize]="maxFileSize"
        [multiple]="multiple"
        [accept]="accept"
        [(ngModel)]="selectedFiles"
      >
        <bit-label>Upload file</bit-label>
        <bit-hint>SVG, PNG, JPG or GIF (MAX. 800x400px)</bit-hint>
      </bit-file-dropzone>
    `,
  }),
  args: {
    multiple: true,
  },
};
