import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";

import { ButtonModule } from "../../button";
import { TypographyModule } from "../../typography";
import { StorybookGlobalStateProvider } from "../../utils";
import { I18nMockService } from "../../utils/i18n-mock.service";
import { DialogModule } from "../dialog.module";

import { DialogContainerComponent } from "./dialog-container.component";

export default {
  title: "Component Library/Dialogs/Dialog Container",
  component: DialogContainerComponent,
  decorators: [
    moduleMetadata({
      imports: [ButtonModule, DialogModule, TypographyModule, NoopAnimationsModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              close: "Close",
              loading: "Loading",
            });
          },
        },
      ],
    }),
    applicationConfig({
      providers: [
        {
          provide: GlobalStateProvider,
          useClass: StorybookGlobalStateProvider,
        },
      ],
    }),
  ],
  args: {
    dialogSize: "default",
    disableAnimations: true,
    disableChrome: false,
  },
} as Meta;

type Story = StoryObj<DialogContainerComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-dialog-container [dialogSize]="dialogSize" [disableAnimations]="disableAnimations" [disableChrome]="disableChrome">
        <div class="tw-p-6">
          <h2 bitTypography="h3">Custom Content</h2>
          <p>
            A dialog container with built-in chrome (background, border, shadow).
            Toggle disableChrome to remove it.
          </p>
          <div class="tw-flex tw-gap-2">
            <button type="button" bitButton buttonType="primary">Action</button>
            <button type="button" bitButton buttonType="secondary" bitDialogClose>Close</button>
          </div>
        </div>
      </bit-dialog-container>
    `,
  }),
};

export const Small: Story = {
  ...Default,
  args: {
    dialogSize: "small",
    disableAnimations: true,
  },
};

export const Large: Story = {
  ...Default,
  args: {
    dialogSize: "large",
    disableAnimations: true,
  },
};

export const NoChrome: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-dialog-container [dialogSize]="dialogSize" [disableAnimations]="disableAnimations" disableChrome>
        <p>A bare container with no visual chrome — just width constraints and focus trapping.</p>
      </bit-dialog-container>
    `,
  }),
  args: {
    dialogSize: "small",
    disableAnimations: true,
  },
};
