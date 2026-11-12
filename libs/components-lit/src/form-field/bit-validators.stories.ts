import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import { Validators } from "../core/validators";
import "../input/input";

export default {
  title: "Component Library/Form/Custom Validators",
  component: "bit-input",
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=13213-55392&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta;

type Story = StoryObj;

export const ForbiddenCharacters: Story = {
  render: () => html`
    <form>
      <bit-input
        label="Name"
        name="name"
        .validators=${[
          Validators.forbiddenCharacters(["\\", "/", "@", "#", "$", "%", "^", "&", "*", "(", ")"]),
        ]}
      ></bit-input>
    </form>
  `,
};

/**
 * `Validators.trim` trims the value when it's committed (blur, Enter or submit) and errors if it
 * contains only whitespace.
 */
export const TrimValidator: Story = {
  render: () => html`
    <form @submit=${(event: Event) => event.preventDefault()}>
      <bit-input label="Name" name="name" .validators=${[Validators.trim]}></bit-input>
    </form>
  `,
};
