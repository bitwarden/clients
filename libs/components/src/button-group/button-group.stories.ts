import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button";
import { I18nMockService } from "../utils/i18n-mock.service";

import { ButtonGroupComponent } from "./button-group.component";

export default {
  title: "Component Library/Button Group",
  component: ButtonGroupComponent,
  decorators: [
    moduleMetadata({
      imports: [ButtonModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => new I18nMockService({ loading: "Loading" }),
        },
      ],
    }),
  ],
} as Meta<ButtonGroupComponent>;

type Story = StoryObj<ButtonGroupComponent>;

export const Default: Story = {
  render: () => ({
    template: /* HTML */ `
      <bit-button-group>
        <button type="button" bitButton buttonType="primary">Save</button>
        <button type="button" bitButton buttonType="secondary">Cancel</button>
      </bit-button-group>
    `,
  }),
};

export const ManyButtons: Story = {
  render: () => ({
    template: /* HTML */ `
      <bit-button-group>
        <button type="button" bitButton buttonType="primary">Create</button>
        <button type="button" bitButton buttonType="secondary">Edit</button>
        <button type="button" bitButton buttonType="secondary">Duplicate</button>
        <button type="button" bitButton buttonType="danger">Delete</button>
      </bit-button-group>
    `,
  }),
};

export const Wrapping: Story = {
  render: () => ({
    template: /* HTML */ `
      <div style="max-width: 220px;">
        <bit-button-group>
          <button type="button" bitButton buttonType="primary">Save changes</button>
          <button type="button" bitButton buttonType="secondary">Cancel</button>
          <button type="button" bitButton buttonType="danger">Delete</button>
        </bit-button-group>
      </div>
    `,
  }),
};
