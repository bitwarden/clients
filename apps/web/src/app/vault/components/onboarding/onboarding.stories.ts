import { importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { I18nPipe } from "@bitwarden/ui-common";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { OnboardingTaskComponent } from "./onboarding-task.component";
import { OnboardingComponent } from "./onboarding.component";

export default {
  title: "Web/Vault/Onboarding",
  component: OnboardingComponent,
  decorators: [
    moduleMetadata({
      imports: [OnboardingComponent, OnboardingTaskComponent, RouterModule, I18nPipe],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(RouterModule.forRoot([], { useHash: true })),
        importProvidersFrom(PreloadedEnglishI18nModule),
      ],
    }),
  ],
  args: {
    createAccount: true,
    importData: false,
    installExtension: false,
  },
  argTypes: {
    createAccount: { control: "boolean" },
    importData: { control: "boolean" },
    installExtension: { control: "boolean" },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LCQc37fIiMvujxrNuxBeEW/Onboarding?node-id=4786-14456",
    },
  },
  render: (args) => ({
    props: args,
    template: `
      <app-onboarding
        [title]="'getStartedWithYourVault' | i18n"
        [subtitle]="'onboardingChecklistSubtitle' | i18n"
        startIcon="bwi-bitwarden-shield"
      >
        <app-onboarding-task
          [title]="'onboardingCreateYourAccountTitle' | i18n"
          [completed]="createAccount"
          [isDisabled]="true"
        ></app-onboarding-task>
        <app-onboarding-task
          [title]="'onboardingImportYourPasswordsTitle' | i18n"
          [subtitle]="'onboardingImportDataSubtitle' | i18n"
          [ctaText]="'onboardingImportCta' | i18n"
          ctaIcon="bwi-import"
          [completed]="importData"
        ></app-onboarding-task>
        <app-onboarding-task
          [title]="'onboardingInstallTheBrowserExtensionTitle' | i18n"
          [subtitle]="'onboardingInstallExtensionSubtitle' | i18n"
          [ctaText]="'onboardingInstallExtensionCta' | i18n"
          ctaIcon="bwi-puzzle"
          [completed]="installExtension"
        ></app-onboarding-task>
      </app-onboarding>
    `,
  }),
} as Meta;

type Story = StoryObj;

export const Empty: Story = {
  args: { createAccount: false, importData: false, installExtension: false },
};

export const OneCompleted: Story = {
  args: { createAccount: true, importData: false, installExtension: false },
};

export const TwoCompleted: Story = {
  args: { createAccount: true, importData: true, installExtension: false },
};

export const AllCompleted: Story = {
  args: { createAccount: true, importData: true, installExtension: true },
};
