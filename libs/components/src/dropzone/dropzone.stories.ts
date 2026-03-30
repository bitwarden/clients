import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { action } from "storybook/actions";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitHintDirective } from "../form-control/hint.directive";
import { BitLabelComponent } from "../form-control/label.component";
import { I18nMockService } from "../utils/i18n-mock.service";

import { DropzoneComponent } from "./dropzone.component";

export default {
  title: "Component Library/Dropzone",
  component: DropzoneComponent,
  decorators: [
    moduleMetadata({
      imports: [DropzoneComponent, BitLabelComponent, BitHintDirective],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              maxFileSizeParam: "Max. File Size: __$1__MB",
              chooseFiles: "Choose files",
              clickToUploadOrDragAndDrop: "Click to upload or drag and drop",
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
      url: "https://www.figma.com/design/rKUVGKb7Kw3d6YGoQl6Ho7/Flowbite-Component-Mapping?node-id=33308-25180&m=dev",
    },
  },
} as Meta<DropzoneComponent>;

type Story = StoryObj<DropzoneComponent>;

export const Default: Story = {
  render: (args) => ({
    props: {
      ...args,
      onFilesSelected: (files: File[]) => {
        action("filesSelected")(files.map((f) => f.name));
      },
    },
    template: /*html*/ `
      <bit-dropzone
        [maxFileSize]="maxFileSize"
        [multiple]="multiple"
        [accept]="accept"
        [hasError]="hasError"
        (filesSelected)="onFilesSelected($event)"
      >
        <bit-label>Upload file</bit-label>
        <bit-hint>SVG, PNG, JPG or GIF (MAX. 800x400px)</bit-hint>
      </bit-dropzone>
    `,
  }),
};

export const Error: Story = {
  ...Default,
  args: {
    hasError: true,
  },
};

export const MultipleFiles: Story = {
  ...Default,
  args: {
    multiple: true,
  },
};
