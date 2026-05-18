import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { CompositePolicyEditorComponent } from "./composite-policy-editor.component";

export default {
  title: "Web/PAM/Policy Editors/Composite (all_of)",
  component: CompositePolicyEditorComponent,
  decorators: [
    moduleMetadata({
      imports: [CompositePolicyEditorComponent],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta<CompositePolicyEditorComponent>;

type Story = StoryObj<CompositePolicyEditorComponent>;

/**
 * Empty — zero children. The component initialises with two, so this story
 * documents the minimum-children warning callout by removing one after render.
 */
export const Empty: Story = {
  render: () => ({
    template: /* HTML */ `
      <div class="tw-max-w-lg tw-p-4">
        <p class="tw-mb-3 tw-text-sm tw-text-muted">
          Remove the second slot via the trash icon to see the minimum-children warning.
        </p>
        <pam-composite-policy-editor
          (policyChange)="lastPolicy = $event"
        ></pam-composite-policy-editor>
        <pre class="tw-mt-4 tw-text-xs">{{ lastPolicy | json }}</pre>
      </div>
    `,
    props: {
      lastPolicy: null,
    },
  }),
};

/** Single child — one slot remaining; illustrates the invalid / warning state. */
export const SingleChild: Story = {
  render: () => ({
    template: /* HTML */ `
      <div class="tw-max-w-lg tw-p-4">
        <p class="tw-mb-3 tw-text-sm tw-text-muted">
          One slot = invalid form. The warning callout is visible and policyChange emits null.
        </p>
        <pam-composite-policy-editor
          (policyChange)="lastPolicy = $event"
        ></pam-composite-policy-editor>
        <pre class="tw-mt-4 tw-text-xs">{{ lastPolicy | json }}</pre>
      </div>
    `,
    props: {
      lastPolicy: null,
    },
  }),
};

/** Three children — full mix: human_approval + ip_allowlist + time_of_day. */
export const ThreeChildren: Story = {
  render: () => ({
    template: /* HTML */ `
      <div class="tw-max-w-lg tw-p-4">
        <p class="tw-mb-3 tw-text-sm tw-text-muted">
          Click "+ Add condition" to add the third child. Once all three unique kinds
          are used the button is replaced by a notice.
        </p>
        <pam-composite-policy-editor
          (policyChange)="lastPolicy = $event"
        ></pam-composite-policy-editor>
        <pre class="tw-mt-4 tw-text-xs">{{ lastPolicy | json }}</pre>
      </div>
    `,
    props: {
      lastPolicy: null,
    },
  }),
};
