import { FormControl, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitHintDirective } from "../form-control/hint.directive";
import { BitLabelComponent } from "../form-control/label.component";
import { I18nMockService } from "../utils/i18n-mock.service";

import { FileUploadComponent } from "./file-upload.component";

export default {
  title: "Component Library/Form/File Upload",
  component: FileUploadComponent,
  decorators: [
    moduleMetadata({
      imports: [
        FileUploadComponent,
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
              chooseFile: "Choose File",
              noFileSelected: "No file selected",
              fileChosen: "File chosen __$1__",
              required: "required",
              inputRequired: "Input is required.",
            }),
        },
      ],
    }),
  ],
  args: {
    accept: "",
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rKUVGKb7Kw3d6YGoQl6Ho7/Flowbite-Component-Mapping?node-id=42260-20194&m=dev",
    },
  },
} as Meta<FileUploadComponent>;

type Story = StoryObj<FileUploadComponent>;

function createErroredControl(message: string): FormControl<File[]> {
  // Errors must come from a validator, not setErrors. Angular's setUpControl calls
  // updateValueAndValidity on mount, which re-runs validators and overwrites any errors set
  // directly via setErrors.
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
      <bit-file-upload [accept]="accept" [(ngModel)]="selectedFiles">
        <bit-label>Upload file</bit-label>
        <bit-hint>SVG, PNG, JPG or GIF (MAX. 800x400px)</bit-hint>
      </bit-file-upload>
    `,
  }),
  args: {
    accept: ".png,.jpg,.gif,.svg",
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
      <bit-file-upload [accept]="accept" [formControl]="requiredControl">
        <bit-label>Upload file</bit-label>
        <bit-hint>SVG, PNG, JPG or GIF (MAX. 800x400px)</bit-hint>
      </bit-file-upload>
    `,
  }),
  args: {
    accept: ".png,.jpg,.gif,.svg",
  },
};

export const WithError: Story = {
  render: (args) => ({
    props: { ...args, fileControl: createErroredControl("File is too large") },
    template: /*html*/ `
      <bit-file-upload [accept]="accept" [formControl]="fileControl">
        <bit-label>Upload file</bit-label>
        <bit-hint>SVG, PNG, JPG or GIF (MAX. 800x400px)</bit-hint>
      </bit-file-upload>
    `,
  }),
  args: {
    accept: ".png,.jpg,.gif,.svg",
  },
};

export const Disabled: Story = {
  render: (args) => ({
    props: { ...args, selectedFiles: [] as File[] },
    template: /*html*/ `
      <bit-file-upload [accept]="accept" [(ngModel)]="selectedFiles" [disabled]="true">
        <bit-label>Upload file</bit-label>
        <bit-hint>SVG, PNG, JPG or GIF (MAX. 800x400px)</bit-hint>
      </bit-file-upload>
    `,
  }),
  args: {
    ...Default.args,
  },
};

export const LongFileName: Story = {
  render: (args) => ({
    props: {
      ...args,
      selectedFiles: [
        createMockFile(
          "annual-report-2024-final-version-reviewed-and-approved-by-all-stakeholders.pdf",
          2_400_000,
        ),
      ],
    },
    template: /*html*/ `
      <bit-file-upload [accept]="accept" [(ngModel)]="selectedFiles">
        <bit-label>Upload file</bit-label>
      </bit-file-upload>
    `,
  }),
  args: {
    accept: ".pdf",
  },
};
