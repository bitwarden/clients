import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import { setAsyncActionErrorHandler } from "../core/async-action";
import { Validators } from "../core/validators";
import "../button/button";
import "../icon-button/icon-button";
import "../input/input";

import { SubmitContext } from "./attach-submit-action";
import "./form";
import { submitAction } from "./submit-action-directive";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const log = (event: Event | HTMLElement, message: string) => {
  const root = (event instanceof Event ? (event.target as HTMLElement) : event).closest(
    "[data-story]",
  );
  const output = root?.querySelector("output");
  if (output) {
    output.textContent = message;
  }
};

const refresh = () => wait(2000);
const remove = () => wait(2000);
const fail = () => wait(1000).then(() => Promise.reject(new Error("Simulated error")));

const fields = html`
  <bit-input label="Name" name="name" required></bit-input>
  <bit-input label="Email" name="email" .validators=${[Validators.email]} required>
    <bit-icon-button
      slot="end"
      icon="bwi-refresh"
      label="Refresh"
      .action=${refresh}
    ></bit-icon-button>
  </bit-input>
  <bit-button class="tw-me-2" type="submit" button-type="primary">Submit</bit-button>
  <bit-button class="tw-me-2" button-type="secondary">Cancel</bit-button>
  <bit-button class="tw-me-2" button-type="danger" .action=${remove}>Delete</bit-button>
  <bit-button class="tw-me-2" button-type="secondary" disabled>Inactive</bit-button>
  <bit-icon-button
    class="tw-me-2"
    button-type="primaryGhost"
    icon="bwi-trash"
    label="Delete"
    .action=${remove}
  ></bit-icon-button>
  <output class="tw-block tw-mt-2 tw-text-sm tw-text-fg-body"></output>
`;

const submit = async ({ form, valid, formData }: SubmitContext) => {
  if (!valid) {
    log(form, "Invalid; handler returned early");
    return;
  }
  await wait(2000);
  log(form, `Submitted ${JSON.stringify(Object.fromEntries(formData))}`);
};

export default {
  title: "Component Library/Async Actions/In Forms",
  decorators: [
    (story) => {
      setAsyncActionErrorHandler((error) => {
        document.querySelectorAll("[data-story] output").forEach((output) => {
          output.textContent = `Error handler called: ${String(error)}`;
        });
      });
      return html`<div data-story>${story()}</div>`;
    },
  ],
} satisfies Meta;

type Story = StoryObj;

/**
 * `submitAction()` on a `<form>` in a Lit template. While submitting, the submit button shows
 * loading and other form buttons are disabled; while a button's own `action` runs, the other
 * buttons are disabled and submit is blocked.
 */
export const UsingPromise: Story = {
  render: () => html`<form ${submitAction(submit)}>${fields}</form>`,
};

/** `<bit-form>` gives a plain-HTML `<form>` the same behavior. */
export const UsingBitFormElement: Story = {
  render: () => html`<bit-form .action=${submit}><form>${fields}</form></bit-form>`,
};

export const RejectedSubmit: Story = {
  render: () => html`<form ${submitAction(fail)}>${fields}</form>`,
};

/** With every control disabled, submit is blocked unless `allowDisabledFormSubmit` is set. */
export const DisabledForm: Story = {
  render: () => html`
    <form ${submitAction(submit)}>
      <bit-input label="Name" name="name" disabled></bit-input>
      <bit-button type="submit" button-type="primary">Submit</bit-button>
    </form>
    <form ${submitAction(submit, { allowDisabledFormSubmit: true })} class="tw-mt-6">
      <bit-input label="Name (allowDisabledFormSubmit)" name="name" disabled></bit-input>
      <bit-button type="submit" button-type="primary">Submit</bit-button>
      <output class="tw-block tw-mt-2 tw-text-sm tw-text-fg-body"></output>
    </form>
  `,
};
