import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitHintDirective } from "../form-control/hint.directive";
import { BitLabelComponent } from "../form-control/label.component";
import { I18nMockService } from "../utils/i18n-mock.service";

import { FileUploadComponent } from "./file-upload.component";

export default {
  title: "Component Library/File Upload/File Upload",
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
              clickToUploadOrDragAndDrop: "Click to upload or drag and drop",
              delete: "Delete",
              loading: "Loading",
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
    props: {
      ...args,
      files: [] as File[],
    },
    template: /*html*/ `
      <bit-file-upload
        [maxFileSize]="maxFileSize"
        [multiple]="multiple"
        [accept]="accept"
        [hasError]="hasError"
        [(files)]="files"
      >
        <bit-label>Upload file</bit-label>
        <bit-hint>SVG, PNG, JPG or GIF (MAX. 800x400px)</bit-hint>
      </bit-file-upload>
    `,
  }),
};

export const MultipleFiles: Story = {
  ...Default,
  args: {
    multiple: true,
  },
};

export const Error: Story = {
  ...Default,
  args: {
    hasError: true,
  },
};

function createMockFile(name: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type: "application/octet-stream" });
}

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
