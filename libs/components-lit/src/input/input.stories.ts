import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../button/button";
import "./input";
import "./textarea";

export default {
  title: "Component Library/Form/Input",
  component: "bit-input",
} satisfies Meta;

type Story = StoryObj;

const showFormData = (event: SubmitEvent) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  const entries = Array.from(new FormData(form).entries()).map(([key, value]) =>
    key === "password" ? `${key}=••••` : `${key}=${String(value)}`,
  );
  form.querySelector("output")!.textContent = entries.join(", ");
};

/**
 * Autofill check: `name` and `autocomplete` are forwarded to the inner `<input>`s. Save a login for
 * this page in a password manager and reload to check that it offers to fill both fields.
 */
export const LoginForm: Story = {
  render: () => html`
    <form method="post" action="#" class="tw-max-w-sm" @submit=${showFormData}>
      <bit-input
        label="Email address"
        type="email"
        name="email"
        autocomplete="username"
        inputmode="email"
        required
      ></bit-input>
      <bit-input
        label="Master password"
        type="password"
        name="password"
        autocomplete="current-password"
        required
        password-toggle
      ></bit-input>
      <bit-button type="submit" button-type="primary" block>Log in</bit-button>
      <output class="tw-block tw-mt-2 tw-text-sm tw-text-fg-body"></output>
    </form>
  `,
};

/** `minlength`, `maxlength`, `min`, `max`, `pattern` and `type="email"` validate on blur. */
export const ConstraintAttributes: Story = {
  render: () => html`
    <bit-input label="Min length 8" minlength="8" value="short"></bit-input>
    <bit-input label="Max length 5" maxlength="5"></bit-input>
    <bit-input label="Number 1-10" type="number" min="1" max="10" value="20"></bit-input>
    <bit-input label="Email" type="email" value="not-an-email"></bit-input>
    <bit-input label="Digits only" pattern="[0-9]*" value="abc"></bit-input>
  `,
  play: async ({ canvasElement }) => {
    canvasElement
      .querySelectorAll<HTMLElement & { markAsTouched(): void }>("bit-input")
      .forEach((input) => input.markAsTouched());
  },
};

export const InForm: Story = {
  render: () => html`
    <form class="tw-max-w-sm" @submit=${showFormData}>
      <bit-input label="Name" name="name" value="Ada"></bit-input>
      <bit-textarea label="Notes" name="notes" value="Hello"></bit-textarea>
      <bit-button type="submit" button-type="primary">Submit</bit-button>
      <bit-button type="reset">Reset</bit-button>
      <output class="tw-block tw-mt-2 tw-text-sm tw-text-fg-body"></output>
    </form>
  `,
};
