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
      imports: [FileUploadComponent, BitLabelComponent, BitHintDirective],
      providers: [
        {
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
} as Meta<FileUploadComponent>;

type Story = StoryObj<FileUploadComponent>;

export const Default: Story = {
  render: (args) => ({
    props: { ...args, files: [] as File[] },
    template: /*html*/ `
      <bit-file-upload [accept]="accept" [errorMessage]="errorMessage" [(files)]="files">
        <bit-label>Upload file</bit-label>
        <bit-hint>SVG, PNG, JPG or GIF (MAX. 800x400px)</bit-hint>
      </bit-file-upload>
    `,
  }),
  args: {
    variant: "default",
    accept: ".png,.jpg,.gif,.svg",
  },
};

export const DefaultWithError: Story = {
  ...Default,
  args: {
    ...Default.args,
    errorMessage: "File is too large",
  },
};

export const DefaultInactive: Story = {
  render: (args) => ({
    props: { ...args, files: [] as File[] },
    template: /*html*/ `
      <bit-file-upload [accept]="accept" [errorMessage]="errorMessage" [(files)]="files" [disabled]="true">
        <bit-label>Upload file</bit-label>
        <bit-hint>SVG, PNG, JPG or GIF (MAX. 800x400px)</bit-hint>
      </bit-file-upload>
    `,
  }),
  args: {
    ...Default.args,
  },
};

export const Dropzone: Story = {
  render: (args) => ({
    props: {
      ...args,
      files: [] as File[],
    },
    template: /*html*/ `
      <bit-file-upload
        [maxFileSize]="maxFileSize"
        [multiple]="multiple"
        [accept]="accept"
        [errorMessage]="errorMessage"
        [(files)]="files"
        [variant]="variant"
      >
        <bit-label>Upload file</bit-label>
        <bit-hint>SVG, PNG, JPG or GIF (MAX. 800x400px)</bit-hint>
      </bit-file-upload>
    `,
  }),
  args: {
    variant: "dropzone",
  },
};

export const MultipleFiles: Story = {
  ...Dropzone,
  args: {
    multiple: true,
  },
};

export const DropzoneDisabled: Story = {
  render: (args) => ({
    props: { ...args, files: [] as File[] },
    template: /*html*/ `
      <bit-file-upload
        [maxFileSize]="maxFileSize"
        [multiple]="multiple"
        [accept]="accept"
        [errorMessage]="errorMessage"
        [(files)]="files"
        variant="dropzone"
        [disabled]="true"
      >
        <bit-label>Upload file</bit-label>
        <bit-hint>SVG, PNG, JPG or GIF (MAX. 800x400px)</bit-hint>
      </bit-file-upload>
    `,
  }),
  args: {
    variant: "dropzone",
  },
};

export const Error: Story = {
  ...Dropzone,
  args: {
    errorMessage: "File is too large",
    variant: "dropzone",
  },
};

function createMockFile(name: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type: "application/octet-stream" });
}

export const LongFileName: Story = {
  render: (args) => ({
    props: {
      ...args,
      files: [
        createMockFile(
          "annual-report-2024-final-version-reviewed-and-approved-by-all-stakeholders.pdf",
          2_400_000,
        ),
      ],
    },
    template: /*html*/ `
      <bit-file-upload [accept]="accept" [(files)]="files">
        <bit-label>Upload file</bit-label>
      </bit-file-upload>
    `,
  }),
  args: {
    variant: "default",
    accept: ".pdf",
  },
};

export const LongFileNamesDropzone: Story = {
  render: (args) => ({
    props: {
      ...args,
      files: [
        createMockFile(
          "annual-report-2024-final-version-reviewed-and-approved-by-all-stakeholders.pdf",
          2_400_000,
        ),
        createMockFile("my-super-long-backup-archive-without-an-extension", 48_000_000),
        createMockFile("client-data-export-q4-2024-north-america-region-full-dataset.csv", 150_000),
      ],
    },
    template: /*html*/ `
      <bit-file-upload [maxFileSize]="maxFileSize" [multiple]="multiple" [(files)]="files" variant="dropzone">
        <bit-label>Upload files</bit-label>
      </bit-file-upload>
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
      files: [
        createMockFile("image.png", 2_400_000),
        createMockFile("document.pdf", 150_000),
        createMockFile("archive.zip", 48_000_000),
      ],
    },
    template: /*html*/ `
      <bit-file-upload
        [maxFileSize]="maxFileSize"
        [multiple]="multiple"
        [accept]="accept"
        [(files)]="files"
      >
        <bit-label>Upload file</bit-label>
        <bit-hint>SVG, PNG, JPG or GIF (MAX. 800x400px)</bit-hint>
      </bit-file-upload>
    `,
  }),
  args: {
    multiple: true,
  },
};
