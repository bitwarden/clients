import { importProvidersFrom } from "@angular/core";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { userEvent } from "storybook/test";

import { DIALOG_DATA, DialogRef } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { accessConnector, connectorId, targetSystem } from "../testing/rotation-builders";

import {
  AssignConnectorDialogComponent,
  AssignConnectorDialogParams,
} from "./assign-connector-dialog.component";

const TARGET = targetSystem({ name: "Prod Entra" });

const OPTIONS = [
  accessConnector({ id: connectorId("1"), name: "eu-west-rotator" }),
  accessConnector({ id: connectorId("2"), name: "us-east-rotator" }),
];

/** Provided per story, since the dialog reads `DIALOG_DATA` once at construction. */
function withParams(params: AssignConnectorDialogParams) {
  return moduleMetadata({
    imports: [AssignConnectorDialogComponent],
    providers: [
      { provide: DIALOG_DATA, useValue: params },
      { provide: DialogRef, useValue: { close: () => {} } },
    ],
  });
}

export default {
  title: "Web/PAM/Rotation/Assign Connector Dialog",
  component: AssignConnectorDialogComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule), provideNoopAnimations()],
    }),
  ],
  render: () => ({ template: `<app-assign-connector-dialog />` }),
} as Meta<AssignConnectorDialogComponent>;

type Story = StoryObj<AssignConnectorDialogComponent>;

export const Default: Story = {
  decorators: [withParams({ targetSystem: TARGET, options: OPTIONS })],
};

/** Assign pressed with nothing chosen, which surfaces the required error. */
export const SelectionRequired: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      canvasElement.querySelector<HTMLButtonElement>("#assign-connector-dialog_button_confirm")!,
    );
  },
};

/** Every enabled access connector is already assigned to this target system. */
export const AllAssigned: Story = {
  decorators: [withParams({ targetSystem: TARGET, options: [] })],
};

/** The organization has no enabled access connector at all. */
export const NoneEligible: Story = {
  decorators: [withParams({ targetSystem: TARGET, options: [], noneEligible: true })],
};
