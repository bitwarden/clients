import { importProvidersFrom } from "@angular/core";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { RotationSdkService } from "../rotation-sdk.service";
import {
  ORGANIZATION_ID,
  id,
  rotationConfigDetail,
  sysId,
  targetSystem,
} from "../testing/rotation-builders";
import { atUrl } from "../testing/story-helpers";

import { RotationConfigEditComponent } from "./rotation-config-edit.component";

const SAMPLE_DETAIL = rotationConfigDetail();

/** An active target and a retired one, so the create picker offers exactly one of them. */
const TARGET_SYSTEMS = [
  targetSystem({ id: sysId("1"), name: "Prod Entra" }),
  targetSystem({ id: sysId("4"), name: "Retired Entra sandbox", status: "disabled" }),
];

function loginCipher(cipherId: string, name: string): CipherView {
  const view = new CipherView();
  view.id = cipherId;
  view.name = name;
  view.type = CipherType.Login;
  return view;
}

const CIPHERS = [
  loginCipher(id("6"), "svc-rotation@corp"),
  loginCipher(id("7"), "sql-admin@reporting"),
];

function rotationSdkFor(systems = TARGET_SYSTEMS): Partial<RotationSdkService> {
  return {
    listTargetSystems: () => Promise.resolve(systems),
    listConfigs: () => Promise.resolve([]),
    getConfig: () => Promise.resolve(SAMPLE_DETAIL),
    createConfig: () => Promise.resolve(SAMPLE_DETAIL),
    updateConfig: () => Promise.resolve(SAMPLE_DETAIL),
    deleteConfig: () => Promise.resolve(),
  };
}

const routes: Routes = [
  {
    path: "organizations/:organizationId/pam/rotation",
    children: [
      { path: "managed-credentials", children: [] },
      { path: "managed-credentials/new", component: RotationConfigEditComponent },
      {
        path: "managed-credentials/:configId",
        pathMatch: "full",
        redirectTo: "managed-credentials/:configId/configuration",
      },
      { path: "managed-credentials/:configId/:tab", component: RotationConfigEditComponent },
    ],
  },
];

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
        { provide: RotationSdkService, useValue: rotationSdkFor() },
        { provide: ToastService, useValue: { showToast: () => {} } },
        { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: ORGANIZATION_ID }) } as unknown as AccountService,
        },
        {
          provide: OrganizationService,
          useValue: { organizations$: () => of([]) } as unknown as OrganizationService,
        },
        {
          provide: CipherService,
          useValue: {
            getManyFromApiForOrganization: () => Promise.resolve(CIPHERS),
          } as unknown as CipherService,
        },
      ],
    }),
  ],
} as Meta<RotationConfigEditComponent>;

type Story = StoryObj<RotationConfigEditComponent>;

/**
 * Edit mode, on the Configuration tab: the breadcrumb trail reads "Managed credentials > Edit
 * managed credential".
 */
export const Edit: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/managed-credentials/${SAMPLE_DETAIL.config.id}/configuration`,
    ),
  ],
};

/** Edit mode, on the History tab: the job table takes the page rather than the form's column. */
export const EditHistory: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/managed-credentials/${SAMPLE_DETAIL.config.id}/history`,
    ),
  ],
};

/** Create mode. */
export const Create: Story = {
  decorators: [atUrl(`/organizations/${ORGANIZATION_ID}/pam/rotation/managed-credentials/new`)],
};

/** Create mode with the target picker empty. */
export const CreateWithNoActiveTargetSystems: Story = {
  decorators: [
    atUrl(`/organizations/${ORGANIZATION_ID}/pam/rotation/managed-credentials/new`),
    applicationConfig({
      providers: [
        {
          provide: RotationSdkService,
          useValue: rotationSdkFor([targetSystem({ status: "disabled" })]),
        },
      ],
    }),
  ],
};
