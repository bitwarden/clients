import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, render } from "lit";

import "../button/button";
import "../callout/callout";

import { openSimpleDialog } from "./dialog-service";
import type { SimpleDialogOptions } from "./simple-dialog-types";

const content = "Dialog content goes here";

const groups: { title: string; dialogs: SimpleDialogOptions[] }[] = [
  {
    title: "Regular",
    dialogs: (["primary", "success", "info", "warning", "danger"] as const).map((type) => ({
      title: `${type[0].toUpperCase()}${type.slice(1)} Type Simple Dialog`,
      content,
      type,
    })),
  },
  {
    title: "Custom",
    dialogs: [
      {
        title: "Primary Type Simple Dialog",
        content,
        type: "primary",
        acceptButtonText: "Ok",
        cancelButtonText: null,
      },
      {
        title: "Primary Type Simple Dialog",
        content,
        type: "primary",
        acceptButtonText: { key: "accept" },
        cancelButtonText: { key: "decline" },
      },
      { title: "Primary Type Simple Dialog", content, type: "primary", acceptButtonText: "Ok" },
    ],
  },
  {
    title: "Icon",
    dialogs: [
      { title: "Primary Type Simple Dialog", content, type: "primary", icon: "bwi-family" },
    ],
  },
  {
    title: "Additional",
    dialogs: [
      { title: "Primary Type Simple Dialog", content, type: "primary", disableClose: true },
      {
        title: "Async",
        content,
        type: "primary",
        acceptAction: () => new Promise((resolve) => setTimeout(resolve, 10000)),
      },
    ],
  },
];

export default {
  title: "Component Library/Dialogs/Service/SimpleConfigurable",
} satisfies Meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const open = async (e: Event, options: SimpleDialogOptions) => {
      const result = (e.target as HTMLElement)
        .closest("[data-root]")!
        .querySelector("[data-result]")!;
      const accepted = await openSimpleDialog(options);
      render(
        html`<bit-callout type=${accepted ? "success" : "info"} heading="Dialog Close Result"
          >${String(accepted)}</bit-callout
        >`,
        result as HTMLElement,
      );
    };
    return html`<div data-root>
      ${groups.map(
        (group) =>
          html`<div>
            <h2>${group.title}</h2>
            <div class="tw-mb-4 tw-flex tw-flex-row tw-gap-2">
              ${group.dialogs.map(
                (dialog) =>
                  html`<bit-button @click=${(e: Event) => open(e, dialog)}
                    >${typeof dialog.title === "string" ? dialog.title : dialog.title.key}</bit-button
                  >`,
              )}
            </div>
          </div>`,
      )}
      <div data-result></div>
    </div>`;
  },
};
