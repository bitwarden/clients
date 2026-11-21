import { Meta, StoryObj, componentWrapperDecorator, moduleMetadata } from "@storybook/angular";

import { autofillStoryProviders } from "../shared/story-providers";

import { InlineMenuButtonComponent } from "./inline-menu-button.component";

export default {
  title: "Browser/Autofill/Inline Menu/Button",
  component: InlineMenuButtonComponent,
  decorators: [
    moduleMetadata({ providers: autofillStoryProviders }),
    componentWrapperDecorator((story) => `<div style="width: 24px">${story}</div>`),
  ],
} as Meta<InlineMenuButtonComponent>;

type Story = StoryObj<InlineMenuButtonComponent>;

export const Unlocked: Story = {
  args: { unlocked: true },
};

export const Locked: Story = {
  args: { unlocked: false },
};
