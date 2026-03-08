import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { action } from "storybook/actions";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { ButtonModule } from "../button";
import { I18nMockService } from "../utils/i18n-mock.service";

import { ToastContainerComponent } from "./toast-container.component";
import { ToastComponent } from "./toast.component";
import { defaultToastConfig, ToastOptions, ToastService } from "./toast.service";

const docsSourceTemplate = `
  <button bitButton type="button" (click)="toastService.showToast(toastOptions)">Show Toast</button>
`;

@Component({
  selector: "toast-service-example",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button bitButton type="button" (click)="toastService.showToast(toastOptions())">
      Show Toast
    </button>
  `,
  imports: [ButtonModule],
})
export class ToastServiceExampleComponent {
  readonly toastOptions = input<ToastOptions>();

  protected readonly toastService = inject(ToastService);
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

export const Service: Story = {
  render: (args) => ({
    props: {
      toastOptions: args,
    },
    template: /*html*/ `
      <!-- Toast container is used here to more closely align with how toasts are used in the clients, which allows for more accurate SR testing in storybook -->
      <bit-toast-container></bit-toast-container>
      <toast-service-example [toastOptions]="toastOptions"></toast-service-example>
    `,
  }),
  args: {
    title: "",
    message: "Hello Bitwarden!",
    variant: "error",
    timeout: defaultToastConfig.timeout,
  } as ToastOptions,
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: {
      source: {
        code: docsSourceTemplate,
      },
    },
  },
};
