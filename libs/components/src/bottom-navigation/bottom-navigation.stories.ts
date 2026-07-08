import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import {
  GeneratorActive,
  GeneratorInactive,
  SendActive,
  SendInactive,
  SettingsActive,
  SettingsInactive,
  VaultActive,
  VaultInactive,
} from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils";

import { BottomNavigationButton, BottomNavigationComponent } from "./bottom-navigation.component";

@Component({
  selector: "story-container",
  template: `
    <div
      class="tw-h-[640px] tw-w-[480px] tw-flex tw-flex-col tw-border tw-border-solid tw-border-secondary-300"
    >
      <ng-content></ng-content>
    </div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StoryContainerComponent {}

@Component({
  selector: "story-page",
  template: `<div class="tw-p-4 tw-text-main">{{ name }} page</div>`,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StoryPageComponent {
  name = "";
}

const navButtons = (showBerry = false): BottomNavigationButton[] => [
  {
    label: "vault",
    page: "/tabs/vault",
    icon: VaultInactive,
    iconActive: VaultActive,
  },
  {
    label: "generator",
    page: "/tabs/generator",
    icon: GeneratorInactive,
    iconActive: GeneratorActive,
  },
  {
    label: "send",
    page: "/tabs/send",
    icon: SendInactive,
    iconActive: SendActive,
  },
  {
    label: "settings",
    page: "/tabs/settings",
    icon: SettingsInactive,
    iconActive: SettingsActive,
    showBerry,
  },
];

export default {
  title: "Component Library/Bottom Navigation",
  component: BottomNavigationComponent,
  decorators: [
    moduleMetadata({
      imports: [
        CommonModule,
        RouterModule,
        BottomNavigationComponent,
        StoryContainerComponent,
        StoryPageComponent,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              vault: "Vault",
              generator: "Generator",
              send: "Send",
              settings: "Settings",
              labelWithNotification: (label: string | undefined) => `${label}: New Notification`,
            });
          },
        },
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(
          RouterModule.forRoot(
            [
              { path: "", redirectTo: "tabs/vault", pathMatch: "full" },
              { path: "tabs/vault", component: StoryPageComponent },
              { path: "tabs/generator", component: StoryPageComponent },
              { path: "tabs/send", component: StoryPageComponent },
              { path: "tabs/settings", component: StoryPageComponent },
              { path: "**", redirectTo: "tabs/vault" },
            ],
            { useHash: true },
          ),
        ),
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<BottomNavigationComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <story-container>
        <div class="tw-flex-1 tw-overflow-y-auto">
          <router-outlet></router-outlet>
        </div>
        <bit-bottom-navigation [navButtons]="navButtons"></bit-bottom-navigation>
      </story-container>`,
  }),
  args: {
    navButtons: navButtons(),
  },
};

export const WithBerry: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <story-container>
        <div class="tw-flex-1 tw-overflow-y-auto">
          <router-outlet></router-outlet>
        </div>
        <bit-bottom-navigation [navButtons]="navButtons"></bit-bottom-navigation>
      </story-container>`,
  }),
  args: {
    navButtons: navButtons(true),
  },
};
