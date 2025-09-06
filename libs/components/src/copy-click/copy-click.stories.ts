import { applicationConfig, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { FormFieldModule } from "../form-field";
import { IconButtonModule } from "../icon-button";
import { InputModule } from "../input";
import { ToastModule } from "../toast";
import { I18nMockService } from "../utils";
import { MockPlatformUtilsService } from "../utils/platform-utils-mock.service";

import { CopyClickDirective } from "./copy-click.directive";

export default {
  title: "Component Library/Copy Click Directive",
  component: CopyClickDirective,
  decorators: [
    moduleMetadata({
      imports: [ToastModule, FormFieldModule, InputModule, IconButtonModule],
    }),
    applicationConfig({
      providers: [
        ToastModule.forRoot().providers!,
        {
          provide: PlatformUtilsService,
          useClass: MockPlatformUtilsService,
        },
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              valueCopied: (text) => `${text} copied`,
              copySuccessful: "Copy Successful",
            });
          },
        },
      ],
    }),
  ],
};

type Story = StoryObj<CopyClickDirective>;

export const Default: Story = {
  render: (args) => ({
    props: {
      value: "testValue123",
      ...args,
    },
    template: /*html*/ `
      <bit-form-field>
        <bit-label>API Key</bit-label>
        <input bitInput disabled [value]="value" />
        <button
          type="button"
          bitSuffix
          bitIconButton="bwi-clone"
          [label]="'Copy'"
          [appCopyClick]="value"
        ></button>
      </bit-form-field>
    `,
  }),
};

export const WithDefaultToast: Story = {
  render: (args) => ({
    props: {
      value: "testValue123",
      ...args,
    },
    template: /*html*/ `
      <bit-form-field>
        <bit-label>API Key</bit-label>
        <input bitInput disabled [value]="value" />
        <button
          type="button"
          bitSuffix
          bitIconButton="bwi-clone"
          [label]="'Copy'"
          [appCopyClick]="value"
          showToast
        ></button>
      </bit-form-field>
    `,
  }),
};

export const WithCustomToastVariant: Story = {
  render: (args) => ({
    props: {
      value: "testValue123",
      ...args,
    },
    template: /*html*/ `
      <bit-form-field>
        <bit-label>API Key</bit-label>
        <input bitInput disabled [value]="value" />
        <button
          type="button"
          bitSuffix
          bitIconButton="bwi-clone"
          [label]="'Copy'"
          [appCopyClick]="value"
          showToast="info"
        ></button>
      </bit-form-field>
    `,
  }),
};

export const WithCustomValueLabel: Story = {
  render: (args) => ({
    props: {
      value: "testValue123",
      ...args,
    },
    template: /*html*/ `
      <bit-form-field>
        <bit-label>API Key</bit-label>
        <input bitInput disabled [value]="value" />
        <button
          type="button"
          bitSuffix
          bitIconButton="bwi-clone"
          [label]="'Copy'"
          [appCopyClick]="value"
          showToast
          valueLabel="API Key"
        ></button>
      </bit-form-field>
    `,
  }),
};
