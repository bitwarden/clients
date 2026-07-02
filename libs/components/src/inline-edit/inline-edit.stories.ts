import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils";

import { InlineEditComponent } from "./inline-edit.component";

export default {
  title: "Component Library/Inline Edit",
  component: InlineEditComponent,
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              inputRequired: "Input is required.",
              inputMaxLength: (max) => `Input cannot exceed ${max} characters.`,
              inputTrimValidator: "Input must not contain only whitespace.",
            });
          },
        },
      ],
    }),
  ],
  args: {
    value: "My project",
    label: "Name",
    editLabel: "Edit name",
    saveLabel: "Save",
    cancelLabel: "Cancel",
    canEdit: true,
    save: () => Promise.resolve(true),
  },
  argTypes: {
    save: { table: { disable: true } },
    editing: { table: { disable: true } },
  },
} as Meta<InlineEditComponent>;

type Story = StoryObj<InlineEditComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-inline-edit
        [value]="value"
        [label]="label"
        [editLabel]="editLabel"
        [saveLabel]="saveLabel"
        [cancelLabel]="cancelLabel"
        [canEdit]="canEdit"
        [save]="save"
      ></bit-inline-edit>
    `,
  }),
};

export const ReadOnly: Story = {
  ...Default,
  args: {
    canEdit: false,
  },
};

export const WithMaxLength: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-inline-edit
        [value]="value"
        [label]="label"
        [editLabel]="editLabel"
        [saveLabel]="saveLabel"
        [cancelLabel]="cancelLabel"
        [canEdit]="canEdit"
        [maxLength]="maxLength"
        [save]="save"
      ></bit-inline-edit>
    `,
  }),
  args: {
    maxLength: 10,
  },
};
