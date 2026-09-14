import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterModule, Routes, provideRouter, withHashLocation } from "@angular/router";
import { Decorator, Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  I18nMockService,
  LayoutComponent,
  NavigationModule,
  StorybookGlobalStateProvider,
} from "@bitwarden/components";
// eslint-disable-next-line no-restricted-imports
import { positionFixedWrapperDecorator } from "@bitwarden/components/src/stories/storybook-decorators";
import { GlobalStateProvider } from "@bitwarden/state";

import { PamOrgNavSlotComponent } from "./pam-org-nav-slot.component";

@Component({
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StoryContentComponent {}

const routes: Routes = [
  {
    path: "pam",
    children: [
      { path: "access-rules", component: StoryContentComponent },
      { path: "audit", component: StoryContentComponent },
      { path: "rotation", component: StoryContentComponent },
    ],
  },
];

/** Renders the story at `url`; hash routing keeps Storybook's own query string intact. */
const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
  };

function organization(canManageAccessRules: boolean, canAccessEventLogs: boolean): Organization {
  return { canManageAccessRules, canAccessEventLogs } as Organization;
}

function featureFlags(options: { rotationEnabled?: boolean } = {}) {
  const { rotationEnabled = false } = options;
  return moduleMetadata({
    providers: [
      {
        provide: ConfigService,
        useValue: {
          getFeatureFlag$: (flag: FeatureFlag) =>
            of(flag === FeatureFlag.Pam || (rotationEnabled && flag === FeatureFlag.PamRotation)),
        },
      },
    ],
  });
}

export default {
  title: "Web/PAM/Org Nav Slot",
  component: PamOrgNavSlotComponent,
  decorators: [
    atUrl("/pam/access-rules"),
    positionFixedWrapperDecorator(),
    moduleMetadata({
      imports: [PamOrgNavSlotComponent, NavigationModule, LayoutComponent, RouterModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              privilegedControls: "Privileged Controls",
              pamAccessRules: "Access rules",
              pamAuditLog: "Audit log",
              pamRotationNav: "Rotation",
              submenu: "submenu",
              toggleCollapse: "toggle collapse",
              toggleSideNavigation: "Toggle side navigation",
              resizeSideNavigation: "Resize side navigation",
              sideNavigation: "Side navigation",
              skipToContent: "Skip to content",
              skipLink: "Skip link",
              loading: "Loading",
            }),
        },
      ],
    }),
    applicationConfig({
      providers: [
        provideRouter(routes, withHashLocation()),
        {
          provide: GlobalStateProvider,
          useClass: StorybookGlobalStateProvider,
        },
      ],
    }),
  ],
  render: (args) => ({
    props: args,
    template: `
      <bit-layout>
        <bit-side-nav>
          <app-pam-org-nav-slot [organization]="organization" />
        </bit-side-nav>
        <router-outlet></router-outlet>
      </bit-layout>
    `,
  }),
} as Meta<PamOrgNavSlotComponent>;

type Story = StoryObj<PamOrgNavSlotComponent>;

/** Both permissions granted, rotation off — the shipped shape of the group today. */
export const Default: Story = {
  decorators: [featureFlags()],
  args: { organization: organization(true, true) },
};

/** Rotation's own flag on top of the other two, adding the third item. */
export const WithRotation: Story = {
  decorators: [featureFlags({ rotationEnabled: true })],
  args: { organization: organization(true, true) },
};

/** No event-log permission — Audit log drops out, leaving Access rules alone. */
export const AccessRulesOnly: Story = {
  decorators: [featureFlags()],
  args: { organization: organization(true, false) },
};
