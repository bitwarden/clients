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
import { ORGANIZATION_ID, targetSystem } from "../testing/rotation-builders";

import { TargetSystemEditComponent } from "./target-system-edit.component";

const SAMPLE_SYSTEM = targetSystem({ name: "Prod Entra" });

const rotationSdk: Partial<RotationSdkService> = {
  listTargetSystems: () => Promise.resolve([SAMPLE_SYSTEM]),
  updateTargetSystem: () => Promise.resolve(),
  enableTargetSystem: () => Promise.resolve(),
  disableTargetSystem: () => Promise.resolve(),
};

/**
 * Mirrors `rotation.routes.ts` (minus its guards) so the page reads `organizationId` /
 * `targetSystemId` from real route params. A stubbed `ActivatedRoute` can't resolve the page's
 * `['..']` breadcrumb, which then falls back to the current URL and renders as the active page
 * instead of a link back to the tab.
 */
const routes: Routes = [
  {
    path: "organizations/:organizationId/pam/rotation",
    children: [
      { path: "target-systems", children: [] },
      { path: "target-systems/new", component: TargetSystemEditComponent },
      { path: "target-systems/:targetSystemId", component: TargetSystemEditComponent },
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
  title: "Web/PAM/Rotation/Target System Edit",
  component: TargetSystemEditComponent,
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
} as Meta<TargetSystemEditComponent>;

type Story = StoryObj<TargetSystemEditComponent>;

/** Edit mode: the breadcrumb trail reads "Target systems > Edit target system". */
export const Edit: Story = {
  decorators: [
    atUrl(`/organizations/${ORGANIZATION_ID}/pam/rotation/target-systems/${SAMPLE_SYSTEM.id}`),
  ],
};
