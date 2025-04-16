import { CommonModule } from "@angular/common";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LinkModule } from "@bitwarden/components";

import { PopupTabNavigationComponent } from "./popup-tab-navigation.component";

export default {
  title: "Browser/PopupTabNavigation",
  component: PopupTabNavigationComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, RouterModule, LinkModule, JslibModule],
      providers: [
        {
          provide: I18nService,
          useValue: {
            t: (key: string, label?: string) =>
              key === "labelWithNotification" && label ? `${label} - New Notification` : key,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {
                title: "Test Title",
              },
            },
          },
        },
      ],
    }),
  ],
} as Meta<PopupTabNavigationComponent>;

type Story = StoryObj<PopupTabNavigationComponent>;

const navButtons = (showBerry = false) => [
  {
    label: "vault",
    page: "/tabs/vault",
    iconKey: "lock",
    iconKeyActive: "lock-f",
  },
  {
    label: "generator",
    page: "/tabs/generator",
    iconKey: "generate",
    iconKeyActive: "generate-f",
  },
  {
    label: "send",
    page: "/tabs/send",
    iconKey: "send",
    iconKeyActive: "send-f",
  },
  {
    label: "settings",
    page: "/tabs/settings",
    iconKey: "cog",
    iconKeyActive: "cog-f",
    showBerry: showBerry,
  },
];

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <popup-tab-navigation [navButtons]="navButtons">
        <router-outlet></router-outlet>
      </popup-tab-navigation>`,
  }),
  args: {
    navButtons: navButtons(),
  },
};

export const WithBerry: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <popup-tab-navigation [navButtons]="navButtons">
        <router-outlet></router-outlet>
      </popup-tab-navigation>`,
  }),
  args: {
    navButtons: navButtons(true),
  },
};
