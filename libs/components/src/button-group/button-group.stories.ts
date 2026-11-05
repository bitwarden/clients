import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { ButtonModule } from "../button";

import { ButtonGroupComponent, ButtonGroupOrientation } from "./button-group.component";

type Args = { orientation: ButtonGroupOrientation; fullWidth: boolean; width: string };

export default {
  title: "Component Library/Button/Group",
  component: ButtonGroupComponent,
  decorators: [
    moduleMetadata({
      imports: [ButtonModule],
    }),
  ],
  args: {
    orientation: "horizontal",
    fullWidth: false,
  },
  argTypes: {
    orientation: {
      options: ["horizontal", "vertical", "auto"],
      control: { type: "radio" },
    },
  },
} as Meta<Args>;

type Story = StoryObj<Args>;

const buttons = /*html*/ `
  <button type="button" bitButton buttonType="secondary" startIcon="bwi-grid">Customize</button>
  <button type="button" bitButton buttonType="secondary" startIcon="bwi-upload">Export</button>
  <button type="button" bitButton buttonType="primary" startIcon="bwi-plus">Invite member</button>
`;

const render: Story["render"] = (args) => ({
  props: args,
  template: /*html*/ `
    <div [style.width]="width">
      <bit-button-group [orientation]="orientation" [fullWidth]="fullWidth">
        ${buttons}
      </bit-button-group>
    </div>
  `,
});

export const Default: Story = {
  render,
  args: { width: "40rem" },
};

export const FullWidth: Story = {
  render,
  args: { width: "40rem", fullWidth: true },
};

export const Vertical: Story = {
  render,
  args: { width: "20rem", orientation: "vertical" },
};

export const AutoFits: Story = {
  render,
  args: { width: "32rem", orientation: "auto", fullWidth: true },
};

export const AutoStacked: Story = {
  render,
  args: { width: "20rem", orientation: "auto", fullWidth: true },
};
