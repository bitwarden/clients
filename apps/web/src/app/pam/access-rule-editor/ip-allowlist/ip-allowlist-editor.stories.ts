import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { IpAllowlistEditorComponent } from "./ip-allowlist-editor.component";

export default {
  title: "Web/PAM/Access Rule Editor/IP Allowlist",
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
    template: /* HTML */ `<app-pam-ip-allowlist-editor [cidrs]="[]"></app-pam-ip-allowlist-editor>`,
  }),
};

export const SingleRow: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <app-pam-ip-allowlist-editor [cidrs]="['10.0.0.0/8']"></app-pam-ip-allowlist-editor>
    `,
  }),
};

export const MultipleRows: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <app-pam-ip-allowlist-editor
        [cidrs]="['10.0.0.0/8', '192.168.1.0/24', '2001:db8::/32']"
      ></app-pam-ip-allowlist-editor>
    `,
  }),
};

export const ReadOnly: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <app-pam-ip-allowlist-editor
        [cidrs]="['10.0.0.0/8', '192.168.1.0/24']"
        [readonly]="true"
      ></app-pam-ip-allowlist-editor>
    `,
  }),
};
