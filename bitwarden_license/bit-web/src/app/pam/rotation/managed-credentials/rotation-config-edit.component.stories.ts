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

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { RotationSdkService } from "../rotation-sdk.service";
import { ORGANIZATION_ID, rotationConfigDetail, targetSystem } from "../testing/rotation-builders";

import { RotationConfigEditComponent } from "./rotation-config-edit.component";

const SAMPLE_DETAIL = rotationConfigDetail();

const rotationSdk: Partial<RotationSdkService> = {
  listTargetSystems: () => Promise.resolve([targetSystem()]),
  getConfig: () => Promise.resolve(SAMPLE_DETAIL),
  updateConfig: () => Promise.resolve(SAMPLE_DETAIL),
  deleteConfig: () => Promise.resolve(),
};

/**
 * Mirrors `rotation.routes.ts` (minus its guards) so the page reads `organizationId` /
 * `configId` from real route params. A stubbed `ActivatedRoute` can't resolve the page's
 * `['..']` breadcrumb, which then falls back to the current URL and renders as the active page
 * instead of a link back to the tab.
 */
const routes: Routes = [
  {
    path: "organizations/:organizationId/pam/rotation",
    children: [
      { path: "managed-credentials", children: [] },
      { path: "managed-credentials/new", component: RotationConfigEditComponent },
      { path: "managed-credentials/:configId", component: RotationConfigEditComponent },
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
  title: "Web/PAM/Rotation/Config Edit",
  component: RotationConfigEditComponent,
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
        // Only reached through `OrgCiphersService.load()`, which the edit path never calls;
        // present so its constructor's `inject()`s resolve.
        { provide: AccountService, useValue: {} as Partial<AccountService> },
        { provide: OrganizationService, useValue: {} as Partial<OrganizationService> },
        { provide: CipherService, useValue: {} as Partial<CipherService> },
      ],
    }),
  ],
} as Meta<RotationConfigEditComponent>;

type Story = StoryObj<RotationConfigEditComponent>;

/** Edit mode: the breadcrumb trail reads "Managed credentials > Edit managed credential". */
export const Edit: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/managed-credentials/${SAMPLE_DETAIL.config.id}`,
    ),
  ],
};
