import { importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { delay, of, startWith } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LinkModule, IconModule, ProgressModule } from "@bitwarden/components";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { OnboardingTaskComponent } from "./onboarding-task.component";
import { OnboardingComponent } from "./onboarding.component";

export default {
  title: "Web/Onboarding",
  component: OnboardingComponent,
  decorators: [
    moduleMetadata({
      imports: [JslibModule, RouterModule, LinkModule, IconModule, ProgressModule],
      declarations: [OnboardingTaskComponent],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(RouterModule.forRoot([], { useHash: true })),
        importProvidersFrom(PreloadedEnglishI18nModule),
      ],
    }),
  ],
  render: (args) => ({
    props: {
      createServiceAccount: false,
      importSecrets$: of(false),
      createSecret: false,
      createProject: false,
      ...args,
    },
    template: `
      <app-onboarding title="Get started">
        <app-onboarding-task
          [title]="'createMachineAccount' | i18n"
          icon="bwi-cli"
          [completed]="createServiceAccount"
        >
          <span>
            {{ "downloadThe" | i18n }} <a bitLink routerLink="">{{ "smCLI" | i18n }}</a>
          </span>
        </app-onboarding-task>
        <app-onboarding-task
          [title]="'createProject' | i18n"
          icon="bwi-collection"
          [completed]="createProject"
        ></app-onboarding-task>
        <app-onboarding-task
          [title]="'importSecrets' | i18n"
          icon="bwi-download"
          [completed]="importSecrets$ | async"
        ></app-onboarding-task>
        <app-onboarding-task
          [title]="'createSecret' | i18n"
          icon="bwi-key"
          [completed]="createSecret"
        ></app-onboarding-task>
      </app-onboarding>
    `,
  }),
} as Meta;

type Story = StoryObj<OnboardingComponent>;

export const Empty: Story = {};

export const Partial = {
  args: {
    createServiceAccount: true,
    createProject: true,
  },
};

export const Full = {
  args: {
    createServiceAccount: true,
    createProject: true,
    createSecret: true,
    importSecrets$: of(true).pipe(delay(0), startWith(false)),
  },
};
