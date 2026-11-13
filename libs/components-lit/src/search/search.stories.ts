import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../button/button";
import "./search";

type Args = { placeholder: string; disabled: boolean; useKeyShortcuts: boolean };

export default {
  title: "Component Library/Form/Search",
  component: "bit-search",
  args: { placeholder: "search", disabled: false, useKeyShortcuts: false },
  render: (args) => html`
    <bit-search
      placeholder=${args.placeholder}
      ?disabled=${args.disabled}
      ?use-key-shortcuts=${args.useKeyShortcuts}
    ></bit-search>
  `,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const WithShortcutHints: Story = { args: { useKeyShortcuts: true } };

export const Disabled: Story = { args: { disabled: true } };

/**
 * ⌘/Ctrl+F is ignored by any search behind an open modal dialog — the browser's native find opens
 * instead. With the dialog that has no search, nothing takes the shortcut at all; with the dialog
 * that has one, the search inside it still responds. Closing either restores the page search.
 */
export const WithDialogOpen: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  render: () => {
    const open = (event: Event, id: string) =>
      (event.target as HTMLElement)
        .closest("div[data-story]")!
        .querySelector<HTMLDialogElement>(`#${id}`)!
        .showModal();
    const close = (event: Event) => (event.target as HTMLElement).closest("dialog")!.close();
    return html`<div data-story>
      <bit-search use-key-shortcuts placeholder="Page search"></bit-search>
      <div class="tw-mt-4 tw-flex tw-gap-2">
        <bit-button @click=${(e: Event) => open(e, "with-search")}>
          Open dialog with a search
        </bit-button>
        <bit-button @click=${(e: Event) => open(e, "without-search")}>
          Open dialog without a search
        </bit-button>
      </div>
      <dialog id="with-search" class="tw-w-96 tw-rounded-xl tw-border-0 tw-p-6 tw-bg-bg-primary">
        <bit-search use-key-shortcuts placeholder="Dialog search"></bit-search>
        <bit-button class="tw-mt-4" @click=${close}>Close</bit-button>
      </dialog>
      <dialog id="without-search" class="tw-w-96 tw-rounded-xl tw-border-0 tw-p-6 tw-bg-bg-primary">
        <p class="tw-text-fg-body">No search in here.</p>
        <bit-button class="tw-mt-4" @click=${close}>Close</bit-button>
      </dialog>
    </div>`;
  },
};
