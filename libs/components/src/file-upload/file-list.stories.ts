import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { FileListComponent } from "./file-list.component";

function createMockFile(name: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type: "application/octet-stream" });
}

const mockFiles = [
  createMockFile("image.png", 2_400_000),
  createMockFile("document.pdf", 150_000),
  createMockFile("archive.zip", 48_000_000),
];

export default {
  title: "Component Library/File Upload/File List",
  component: FileListComponent,
  decorators: [
    moduleMetadata({
      imports: [FileListComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              delete: "Delete",
              loading: "Loading",
            }),
        },
      ],
    }),
  ],
} as Meta<FileListComponent>;

type Story = StoryObj<FileListComponent>;

export const Default: Story = {
  args: {
    files: mockFiles,
  },
};
