import { importProvidersFrom } from "@angular/core";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Decorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";

import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { RotationSdkService } from "../rotation-sdk.service";
import {
  accessConnector,
  accessConnectorDetail,
  ORGANIZATION_ID,
  targetSystem,
} from "../testing/rotation-builders";

import { DaemonDetailComponent } from "./daemon-detail.component";

const SAMPLE_DETAIL = accessConnectorDetail({
  connector: accessConnector({ name: "Prod on-prem connector" }),
});

const rotationSdk: Partial<RotationSdkService> = {
  listTargetSystems: () => Promise.resolve([targetSystem()]),
  getConnector: () => Promise.resolve(SAMPLE_DETAIL),
  enableConnector: () => Promise.resolve(),
  disableConnector: () => Promise.resolve(),
  deleteConnector: () => Promise.resolve(),
};

/**
 * Mirrors `rotation.routes.ts` (minus its guards) so the page reads `organizationId` /
 * `daemonId` from real route params. A stubbed `ActivatedRoute` can't resolve the page's
 * `['..']` breadcrumb, which then falls back to the current URL and renders as the active page
 * instead of a link back to the tab.
 */
const routes: Routes = [
  {
    path: "organizations/:organizationId/pam/rotation",
    children: [
      { path: "access-connectors", children: [] },
      { path: "access-connectors/:daemonId", component: DaemonDetailComponent },
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

export default {
  title: "Web/PAM/Rotation/Access Connector Detail",
  component: DaemonDetailComponent,
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  decorators: [
    componentWrapperDecorator((story) => `<div class="tw-p-6">${story}</div>`),
    moduleMetadata({ imports: [RouterOutlet] }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter(routes, withHashLocation()),
        { provide: RotationSdkService, useValue: rotationSdk },
        { provide: ToastService, useValue: { showToast: () => {} } },
        { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
      ],
    }),
  ],
} as Meta<DaemonDetailComponent>;

type Story = StoryObj<DaemonDetailComponent>;

/** The breadcrumb trail reads "Access connectors > Prod on-prem connector" — the connector's own name. */
export const Default: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/access-connectors/${SAMPLE_DETAIL.connector.id}`,
    ),
  ],
};
