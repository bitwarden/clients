import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../button/button";
import "../input/input";
import "./error-summary";

export default {
  title: "Component Library/Form/Error Summary",
  component: "bit-error-summary",
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=13213-55392&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta;

type Story = StoryObj;

/** Counts errors in the enclosing native `<form>`; submit to see all of them. */
export const Default: Story = {
  render: () => html`
    <form
      novalidate
      @submit=${(event: Event) => {
        event.preventDefault();
        const form = event.target as HTMLFormElement;
        Array.from(form.elements).forEach((el) =>
          (el as { markAsTouched?: () => void }).markAsTouched?.(),
        );
      }}
    >
      <bit-input label="Name" name="name" required></bit-input>
      <bit-input label="Email" name="email" type="email" required></bit-input>
      <bit-button type="submit" button-type="primary">Submit</bit-button>
      <bit-error-summary></bit-error-summary>
    </form>
  `,
};
