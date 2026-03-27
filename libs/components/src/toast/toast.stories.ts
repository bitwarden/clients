import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { action } from "storybook/actions";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { ButtonModule } from "../button";
import { I18nMockService } from "../utils/i18n-mock.service";

import { ToastContainerComponent } from "./toast-container.component";
import { ToastComponent } from "./toast.component";
import { ToastOptions, ToastService } from "./toast.service";

const docsSourceTemplate = `
  <button bitButton type="button" (click)="toastService.showToast(toastOptions)">Show Toast</button>
`;

const cyclingToasts = [
  { variant: "success", message: "Item added to your vault." },
  {
    variant: "error",
    title: "Connection failed",
    message: "Failed to save changes. Please try again.",
  },
  {
    variant: "warning",
    message: ["Your session will expire in 5 minutes.", "Save your work before it ends."],
  },
  {
    variant: "info",
    title: "Update available",
    message: ["Bitwarden has a new version ready.", "Restart the app to apply the update."],
  },
  { variant: "success", title: "Import complete", message: "153 items were added to your vault." },
  {
    variant: "error",
    message: ["An unexpected error occurred.", "If this keeps happening, contact support."],
  },
] as ToastOptions[];

@Component({
  selector: "toast-service-example",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <button bitButton type="button" (click)="showNext()">Show Toast</button> `,
  imports: [ButtonModule],
})
export class ToastServiceExampleComponent {
  private readonly index = signal(0);
  protected readonly toastService = inject(ToastService);

  showNext() {
    const i = this.index();
    this.toastService.showToast(cyclingToasts[i % cyclingToasts.length]);
    this.index.set(i + 1);
  }
}

export default {
  title: "Component Library/Toast",
  component: ToastComponent,

  decorators: [
    moduleMetadata({
      imports: [
        BrowserAnimationsModule,
        ButtonModule,
        ToastContainerComponent,
        ToastServiceExampleComponent,
      ],
    }),
    applicationConfig({
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              close: "Close",
              success: "Success",
              error: "Error",
              warning: "Warning",
              info: "Info",
              loading: "Loading",
            });
          },
        },
      ],
    }),
  ],
  args: {
    onClose: action("emit onClose"),
    variant: "info",
    title: "",
    message: "Hello Bitwarden!",
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-41506&t=b5tDKylm5sWm2yKo-11",
    },
  },
} as Meta;

type Story = StoryObj<ToastComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-min-w tw-max-w-[19rem]">
        <bit-toast ${formatArgsForCodeSnippet<ToastComponent>(args)}></bit-toast>
      </div>
    `,
  }),
};

export const Variants: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-flex tw-flex-col tw-min-w tw-max-w-[19rem] tw-gap-2">
        <bit-toast ${formatArgsForCodeSnippet<ToastComponent>(args)} variant="success"></bit-toast>
        <bit-toast ${formatArgsForCodeSnippet<ToastComponent>(args)} variant="info"></bit-toast>
        <bit-toast ${formatArgsForCodeSnippet<ToastComponent>(args)} variant="warning"></bit-toast>
        <bit-toast ${formatArgsForCodeSnippet<ToastComponent>(args)} variant="error"></bit-toast>
      </div>
    `,
  }),
};

/**
 * Avoid using long messages in toasts.
 */
export const LongContent: Story = {
  ...Default,
  args: {
    title: "Foo",
    message: [
      "Maecenas commodo posuere quam, vel malesuada nulla accumsan ac.",
      "Pellentesque interdum ligula ante, eget bibendum ante lacinia congue.",
    ],
  },
};

/**
 * Callers that still pass the deprecated `title` field will have it prepended as the first line of the message.
 */
export const DeprecatedTitle: Story = {
  ...Default,
  args: {
    title: "Vault locked",
    message: "Your session has timed out.",
    variant: "info",
  } as ToastOptions,
};

export const Service: Story = {
  render: () => ({
    template: /*html*/ `
      <!-- Toast container is used here to more closely align with how toasts are used in the clients, which allows for more accurate SR testing in storybook -->
      <bit-toast-container></bit-toast-container>
      <toast-service-example></toast-service-example>
    `,
  }),
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: {
      source: {
        code: docsSourceTemplate,
      },
    },
  },
};
