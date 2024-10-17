import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { FormFieldModule } from "../form-field";
import { MultiSelectComponent } from "../multi-select/multi-select.component";
import { I18nMockService } from "../utils/i18n-mock.service";

import { SelectComponent } from "./select.component";
import { SelectModule } from "./select.module";

export default {
  title: "Component Library/Form/Select",
  component: SelectComponent,
  decorators: [
    moduleMetadata({
      imports: [SelectModule, FormFieldModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              selectPlaceholder: "-- Select --",
            });
          },
        },
      ],
    }),
  ],
  args: {
    disabled: false,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/file/3tWtMSYoLB0ZLEimLNzYsm/End-user-%26-admin-Vault-Refresh?t=7QEmGA69YTOF8sXU-0",
    },
  },
} as Meta;

type Story = StoryObj<MultiSelectComponent>;

export const Default: Story = {
  render: (args) => ({
    props: {
      ...args,
    },
    template: /*html*/ `
      <bit-form-field>
        <bit-label>Choose a value</bit-label>
        <bit-select [disabled]="disabled">
          <bit-option value="value1" label="Value 1" icon="bwi-collection"></bit-option>
          <bit-option value="value2" label="Value 2" icon="bwi-collection"></bit-option>
          <bit-option value="value3" label="Value 3" icon="bwi-collection"></bit-option>
          <bit-option value="value4" label="Value 4" icon="bwi-collection" disabled></bit-option>
        </bit-select>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const Disabled: Story = {
  ...Default,
  args: {
    disabled: true,
  },
};
