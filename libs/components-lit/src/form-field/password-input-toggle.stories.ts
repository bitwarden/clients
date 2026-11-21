import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../input/input";

type Args = { toggled: boolean };

export default {
  title: "Component Library/Form/Password Toggle",
  component: "bit-input",
  args: { toggled: false },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=13213-55392&t=b5tDKylm5sWm2yKo-4",
    },
    docs: {
      description: {
        component:
          '`password-toggle` on a `type="password"` `bit-input` adds a button that shows or hides the password. `toggled` reflects the state and `toggledChange` fires when it changes.',
      },
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {
  render: () => html`
    <form>
      <bit-input label="Password" type="password" password-toggle></bit-input>
    </form>
  `,
};

export const Binding: Story = {
  render: (args) => {
    const sync = (event: Event) => {
      const root = (event.target as HTMLElement).closest("form")!;
      const input = root.querySelector("bit-input")!;
      const checkbox = root.querySelector<HTMLInputElement>("input[type=checkbox]")!;
      if (event.type === "toggledChange") {
        checkbox.checked = input.toggled;
      } else {
        input.toggled = checkbox.checked;
      }
    };
    return html`
      <form>
        <bit-input
          label="Password"
          type="password"
          password-toggle
          ?toggled=${args.toggled}
          @toggledChange=${sync}
        ></bit-input>
        <label class="tw-text-main">
          Checked:
          <input type="checkbox" .checked=${args.toggled} @change=${sync} />
        </label>
      </form>
    `;
  },
};
