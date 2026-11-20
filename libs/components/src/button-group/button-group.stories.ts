import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { ButtonModule } from "../button";

import { ButtonGroupComponent, ButtonGroupOrientation } from "./button-group.component";

type Args = { orientation: ButtonGroupOrientation; fullWidth: boolean };

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

const renderAt =
  (width: string): Story["render"] =>
  (args) => ({
    props: args,
    template: /*html*/ `
    <div style="width: ${width}">
      <bit-button-group [orientation]="orientation" [fullWidth]="fullWidth">
        ${buttons}
      </bit-button-group>
    </div>
  `,
  });

export const Default: Story = {
  render: renderAt("40rem"),
};

export const FullWidth: Story = {
  render: renderAt("40rem"),
  args: { fullWidth: true },
};

export const Vertical: Story = {
  render: renderAt("20rem"),
  args: { orientation: "vertical" },
};

export const AutoFits: Story = {
  render: renderAt("32rem"),
  args: { orientation: "auto", fullWidth: true },
};

export const AutoStacked: Story = {
  render: renderAt("20rem"),
  args: { orientation: "auto", fullWidth: true },
};
