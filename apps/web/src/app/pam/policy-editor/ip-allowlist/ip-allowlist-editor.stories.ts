import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { importProvidersFrom } from "@angular/core";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { IpAllowlistEditorComponent } from "./ip-allowlist-editor.component";

export default {
  title: "Web/PAM/Policy Editor/IP Allowlist",
  component: IpAllowlistEditorComponent,
  decorators: [
    moduleMetadata({
      imports: [IpAllowlistEditorComponent],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type Story = StoryObj<IpAllowlistEditorComponent>;

export const Empty: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `<pam-ip-allowlist-editor [cidrs]="[]"></pam-ip-allowlist-editor>`,
  }),
};

export const SingleRow: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <pam-ip-allowlist-editor [cidrs]="['10.0.0.0/8']"></pam-ip-allowlist-editor>
    `,
  }),
};

export const MultipleRows: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <pam-ip-allowlist-editor
        [cidrs]="['10.0.0.0/8', '192.168.1.0/24', '2001:db8::/32']"
      ></pam-ip-allowlist-editor>
    `,
  }),
};

export const ReadOnly: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <pam-ip-allowlist-editor
        [cidrs]="['10.0.0.0/8', '192.168.1.0/24']"
        [readonly]="true"
      ></pam-ip-allowlist-editor>
    `,
  }),
};
