import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../button/button";
import "./file-dropzone";

type Args = { maxFileSize: number; multiple: boolean; accept: string };

const createMockFile = (name: string, sizeBytes: number) =>
  new File([new Uint8Array(sizeBytes)], name, { type: "application/octet-stream" });

export default {
  title: "Component Library/Form/File Dropzone",
  component: "bit-file-dropzone",
  args: { maxFileSize: 30, multiple: false, accept: "" },
  render: (args) => html`
    <bit-file-dropzone
      max-file-size=${args.maxFileSize}
      ?multiple=${args.multiple}
      accept=${args.accept}
      label="Upload file"
      hint="SVG, PNG, JPG or GIF (MAX. 800x400px)"
    ></bit-file-dropzone>
  `,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rKUVGKb7Kw3d6YGoQl6Ho7/Flowbite-Component-Mapping?node-id=42260-20194&m=dev",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const MultipleFiles: Story = {
  args: { multiple: true },
  parameters: { chromatic: { disableSnapshot: true } },
};

export const Required: Story = {
  render: (args) => html`
    <bit-file-dropzone
      max-file-size=${args.maxFileSize}
      ?multiple=${args.multiple}
      required
      label="Upload file"
    ></bit-file-dropzone>
  `,
};

export const Disabled: Story = {
  render: (args) => html`
    <bit-file-dropzone
      max-file-size=${args.maxFileSize}
      disabled
      label="Upload file"
      hint="SVG, PNG, JPG or GIF (MAX. 800x400px)"
    ></bit-file-dropzone>
  `,
};

export const WithError: Story = {
  render: (args) => html`
    <bit-file-dropzone
      max-file-size=${args.maxFileSize}
      label="Upload file"
      hint="SVG, PNG, JPG or GIF (MAX. 800x400px)"
      .validators=${[() => ({ custom: { message: "File is too large" } })]}
    ></bit-file-dropzone>
  `,
  play: async ({ canvasElement }) => {
    canvasElement.querySelector("bit-file-dropzone")?.markAsTouched();
  },
};

export const LongFileNames: Story = {
  args: { multiple: true },
  render: (args) => html`
    <bit-file-dropzone
      max-file-size=${args.maxFileSize}
      ?multiple=${args.multiple}
      label="Upload files"
      .value=${[
        createMockFile(
          "annual-report-2024-final-version-reviewed-and-approved-by-all-stakeholders.pdf",
          2_400_000,
        ),
        createMockFile("my-super-long-backup-archive-without-an-extension", 48_000_000),
        createMockFile("client-data-export-q4-2024-north-america-region-full-dataset.csv", 150_000),
      ]}
    ></bit-file-dropzone>
  `,
};

export const WithFiles: Story = {
  args: { multiple: true },
  render: (args) => html`
    <bit-file-dropzone
      max-file-size=${args.maxFileSize}
      ?multiple=${args.multiple}
      label="Upload file"
      hint="SVG, PNG, JPG or GIF (MAX. 800x400px)"
      .value=${[
        createMockFile("image.png", 2_400_000),
        createMockFile("document.pdf", 150_000),
        createMockFile("archive.zip", 48_000_000),
      ]}
    ></bit-file-dropzone>
  `,
};

/** With a `name`, every file is a `FormData` entry. */
export const InForm: Story = {
  render: () => html`
    <form
      @submit=${(event: SubmitEvent) => {
        event.preventDefault();
        const form = event.target as HTMLFormElement;
        const files = new FormData(form).getAll("attachments") as File[];
        form.querySelector("output")!.textContent =
          `attachments=[${files.map((f) => f.name).join(", ")}]`;
      }}
    >
      <bit-file-dropzone
        name="attachments"
        multiple
        label="Attachments"
        .value=${[createMockFile("image.png", 2_400_000), createMockFile("notes.txt", 1_200)]}
      ></bit-file-dropzone>
      <bit-button type="submit" button-type="primary">Submit</bit-button>
      <output class="tw-block tw-mt-2 tw-text-sm tw-text-fg-body"></output>
    </form>
  `,
};
