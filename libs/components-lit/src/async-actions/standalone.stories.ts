import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import { setAsyncActionErrorHandler } from "../core/async-action";
import "../button/button";
import "../icon-button/icon-button";

const status = (event: Event | undefined, text: string) => {
  const root = (event?.target as HTMLElement | undefined)?.closest("[data-story]");
  const el = root?.querySelector("[data-status]");
  if (el) {
    el.textContent = text;
  }
};

const template = (delay: number, reject = false) => {
  let lastEvent: Event | undefined;
  const action = () =>
    new Promise<void>((resolve, rejectPromise) =>
      setTimeout(() => {
        if (reject) {
          rejectPromise(new Error("Simulated error"));
          return;
        }
        status(lastEvent, "🟢");
        resolve();
      }, delay),
    );
  return html`<div data-story @click=${(event: Event) => (lastEvent = event)}>
    <bit-button button-type="primary" class="tw-me-2" .action=${action}>
      Perform action <span data-status>🟡</span>
    </bit-button>
    <bit-icon-button
      label="Delete"
      icon="bwi-trash"
      button-type="dangerGhost"
      .action=${action}
    ></bit-icon-button>
    <output class="tw-block tw-mt-2 tw-text-sm tw-text-fg-body"></output>
  </div>`;
};

export default {
  title: "Component Library/Async Actions/Standalone",
  decorators: [
    (story) => {
      setAsyncActionErrorHandler((error) => {
        document.querySelectorAll("[data-story] output").forEach((output) => {
          output.textContent = `Error handler called: ${String(error)}`;
        });
      });
      return story();
    },
  ],
} satisfies Meta;

type Story = StoryObj;

export const UsingPromise: Story = { render: () => template(5000) };

export const RejectedPromise: Story = { render: () => template(2000, true) };

/** Quick actions don't flash a spinner. */
export const ActionResolvesQuickly: Story = { render: () => template(50) };
