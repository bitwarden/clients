import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../button/button";
import "./file-upload";

type Args = { accept: string };

const createMockFile = (name: string, sizeBytes: number) =>
  new File([new Uint8Array(sizeBytes)], name, { type: "application/octet-stream" });

export default {
  title: "Component Library/Form/File Upload",
  component: "bit-file-upload",
  args: { accept: ".png,.jpg,.gif,.svg" },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rKUVGKb7Kw3d6YGoQl6Ho7/Flowbite-Component-Mapping?node-id=42260-20194&m=dev",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {
  render: (args) => html`
    <bit-file-upload
      accept=${args.accept}
      label="Upload file"
      hint="SVG, PNG, JPG or GIF (MAX. 800x400px)"
    ></bit-file-upload>
  `,
};

export const Required: Story = {
  render: (args) => html`
    <bit-file-upload
      accept=${args.accept}
      required
      label="Upload file"
      hint="SVG, PNG, JPG or GIF (MAX. 800x400px)"
    ></bit-file-upload>
  `,
};

export const WithError: Story = {
  render: (args) => html`
    <bit-file-upload
      accept=${args.accept}
      label="Upload file"
      hint="SVG, PNG, JPG or GIF (MAX. 800x400px)"
      .validators=${[() => ({ custom: { message: "File is too large" } })]}
    ></bit-file-upload>
  `,
  play: async ({ canvasElement }) => {
    canvasElement.querySelector("bit-file-upload")?.markAsTouched();
  },
};

export const Disabled: Story = {
  render: (args) => html`
    <bit-file-upload
      accept=${args.accept}
      disabled
      label="Upload file"
      hint="SVG, PNG, JPG or GIF (MAX. 800x400px)"
    ></bit-file-upload>
  `,
};

export const LongFileName: Story = {
  args: { accept: ".pdf" },
  render: (args) => html`
    <bit-file-upload
      accept=${args.accept}
      label="Upload file"
      .value=${createMockFile(
        "annual-report-2024-final-version-reviewed-and-approved-by-all-stakeholders.pdf",
        2_400_000,
      )}
    ></bit-file-upload>
  `,
};

/** With a `name`, the chosen file is part of the form's `FormData`. */
export const InForm: Story = {
  render: () => html`
    <form
      @submit=${(event: SubmitEvent) => {
        event.preventDefault();
        const form = event.target as HTMLFormElement;
        const file = new FormData(form).get("license");
        form.querySelector("output")!.textContent =
          file instanceof File && file.name ? `license=${file.name} (${file.size} B)` : "No file";
      }}
    >
      <bit-file-upload name="license" accept=".json" label="License file"></bit-file-upload>
      <bit-button type="submit" button-type="primary">Submit</bit-button>
      <output class="tw-block tw-mt-2 tw-text-sm tw-text-fg-body"></output>
    </form>
  `,
};
