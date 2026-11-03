import { importProvidersFrom } from "@angular/core";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { provideRouter, withHashLocation } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { userEvent } from "storybook/test";

import { DIALOG_DATA, DialogRef } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { accessConnector, sysId, targetSystem } from "../testing/rotation-builders";

import {
  AssignTargetDialogComponent,
  AssignTargetDialogParams,
} from "./assign-target-dialog.component";

const CONNECTOR = accessConnector({ name: "eu-west-rotator" });

const OPTIONS = [
  targetSystem({ id: sysId("1"), name: "Prod Entra" }),
  targetSystem({ id: sysId("2"), name: "Corporate Active Directory" }),
  targetSystem({ id: sysId("3"), name: "Staging LDAP" }),
];

/** Provided per story, since the dialog reads `DIALOG_DATA` once at construction. */
function withParams(params: AssignTargetDialogParams) {
  return moduleMetadata({
    imports: [AssignTargetDialogComponent],
    providers: [
      { provide: DIALOG_DATA, useValue: params },
      { provide: DialogRef, useValue: { close: () => {} } },
    ],
  });
}

export default {
  title: "Web/PAM/Rotation/Assign Target Dialog",
  component: AssignTargetDialogComponent,
  decorators: [
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter([], withHashLocation()),
        provideNoopAnimations(),
      ],
    }),
  ],
  render: () => ({ template: `<app-assign-target-dialog />` }),
} as Meta<AssignTargetDialogComponent>;

type Story = StoryObj<AssignTargetDialogComponent>;

export const Default: Story = {
  decorators: [
    withParams({ accessConnector: CONNECTOR, options: OPTIONS, noActiveAutomaticSystems: false }),
  ],
};

/** Assign pressed with nothing chosen, which surfaces the required error. */
export const SelectionRequired: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      canvasElement.querySelector<HTMLButtonElement>("#assign-target-dialog_button_confirm")!,
    );
  },
};

/** Every automatic target system is already assigned to this connector. */
export const AllAssigned: Story = {
  decorators: [
    withParams({ accessConnector: CONNECTOR, options: [], noActiveAutomaticSystems: false }),
  ],
};

/** The organization has no automatic target system, so the dialog links to where to add one. */
export const NoTargetSystems: Story = {
  decorators: [
    withParams({ accessConnector: CONNECTOR, options: [], noActiveAutomaticSystems: true }),
  ],
};
