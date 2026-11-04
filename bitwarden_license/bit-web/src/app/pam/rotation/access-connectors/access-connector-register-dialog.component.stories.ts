import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { userEvent } from "storybook/test";

import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { RotationSdkService } from "../rotation-sdk.service";
import { ORGANIZATION_ID } from "../testing/rotation-builders";

import {
  AccessConnectorRegisterDialogComponent,
  AccessConnectorRegisterDialogParams,
} from "./access-connector-register-dialog.component";

const params: AccessConnectorRegisterDialogParams = { organizationId: ORGANIZATION_ID };

const NAME_INPUT = "#access-connector-register-dialog_input_name";
const SUBMIT_BUTTON = "#access-connector-register-dialog_button_submit";

export default {
  title: "Web/PAM/Rotation/Access Connector Register Dialog",
  component: AccessConnectorRegisterDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [AccessConnectorRegisterDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: { close: () => Promise.resolve() } },
        // Registering hands off to the token dialog, which has its own stories.
        { provide: DialogService, useValue: { open: (): undefined => undefined } },
        { provide: ToastService, useValue: { showToast: () => {} } },
        {
          provide: RotationSdkService,
          useValue: { registerConnector: () => new Promise(() => {}) },
        },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
  render: () => ({ template: `<app-access-connector-register-dialog />` }),
} as Meta<AccessConnectorRegisterDialogComponent>;

type Story = StoryObj<AccessConnectorRegisterDialogComponent>;

export const Default: Story = {};

export const Completed: Story = {
  play: async ({ canvasElement }) => {
    const name = canvasElement.querySelector<HTMLInputElement>(NAME_INPUT)!;
    await userEvent.type(name, "eu-west-rotator");
  },
};

/** Submitted empty, which surfaces the required error. */
export const NameRequired: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(canvasElement.querySelector<HTMLButtonElement>(SUBMIT_BUTTON)!);
  },
};

/** Registration never settles, so the submit button stays in its loading state. */
export const Registering: Story = {
  play: async ({ canvasElement }) => {
    const name = canvasElement.querySelector<HTMLInputElement>(NAME_INPUT)!;
    await userEvent.type(name, "eu-west-rotator");
    await userEvent.click(canvasElement.querySelector<HTMLButtonElement>(SUBMIT_BUTTON)!);
  },
};
