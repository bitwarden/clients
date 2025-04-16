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

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <popup-tab-navigation>
        <router-outlet></router-outlet>
      </popup-tab-navigation>`,
  }),
};

export const WithBerry: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <popup-tab-navigation [showBerry]="showBerry">
        <router-outlet></router-outlet>
      </popup-tab-navigation>`,
  }),
  args: {
    showBerry: true,
  },
};
