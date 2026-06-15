import { importProvidersFrom } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { IpAllowlistEditorComponent } from "./ip-allowlist-editor.component";

export default {
  title: "Web/PAM/Access Rule Editor/IP Allowlist",
  component: IpAllowlistEditorComponent,
  decorators: [
    moduleMetadata({
      imports: [IpAllowlistEditorComponent, ReactiveFormsModule],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type Story = StoryObj<IpAllowlistEditorComponent>;

export const Empty: Story = {
  render: () => ({
    props: { control: new FormControl<string[]>([]) },
    template: /* HTML */ `<app-pam-ip-allowlist-editor
      [formControl]="control"
    ></app-pam-ip-allowlist-editor>`,
  }),
};

export const SingleRow: Story = {
  render: () => ({
    props: { control: new FormControl<string[]>(["10.0.0.0/8"]) },
    template: /* HTML */ `<app-pam-ip-allowlist-editor
      [formControl]="control"
    ></app-pam-ip-allowlist-editor>`,
  }),
};

export const MultipleRows: Story = {
  render: () => ({
    props: {
      control: new FormControl<string[]>(["10.0.0.0/8", "192.168.1.0/24", "2001:db8::/32"]),
    },
    template: /* HTML */ `<app-pam-ip-allowlist-editor
      [formControl]="control"
    ></app-pam-ip-allowlist-editor>`,
  }),
};

export const ReadOnly: Story = {
  render: () => ({
    props: { control: new FormControl<string[]>(["10.0.0.0/8", "192.168.1.0/24"]) },
    template: /* HTML */ `<app-pam-ip-allowlist-editor
      [formControl]="control"
      [readonly]="true"
    ></app-pam-ip-allowlist-editor>`,
  }),
};
