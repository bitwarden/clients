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

import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { DaemonsService } from "../daemons/daemons.service";
import { AccessConnector, TargetSystem } from "../rotation";
import { ORGANIZATION_ID, sysId, targetSystem } from "../testing/rotation-builders";
import { atUrl } from "../testing/story-helpers";

import { TargetSystemsTabComponent } from "./target-systems-tab.component";
import { TargetSystemsService } from "./target-systems.service";

/**
 * Every method, kind and status the chips can offer, so each one narrows the table: two methods
 * (the manual target also being the one with no kind), three kinds, and both statuses.
 */
const SYSTEMS: TargetSystem[] = [
  targetSystem({ id: sysId("1"), name: "Prod Entra", kind: "entra" }),
  targetSystem({ id: sysId("2"), name: "Reporting SQL", kind: "mssql" }),
  targetSystem({ id: sysId("3"), name: "Billing rotation script", kind: "custom_script" }),
  targetSystem({
    id: sysId("4"),
    name: "Retired Entra sandbox",
    kind: "entra",
    status: "disabled",
  }),
  targetSystem({
    id: sysId("5"),
    name: "Legacy mainframe",
    method: "manual",
    kind: null,
    supportsSessionTermination: false,
  }),
];

function rotationServices(systems: TargetSystem[]) {
  return moduleMetadata({
    imports: [RouterOutlet],
    providers: [
      {
        provide: TargetSystemsService,
        useValue: {
          loading$: of(false),
          systems$: of(systems),
          systemById$: of(new Map(systems.map((s) => [s.id, s] as const))),
          activeAutomaticSystems$: of(systems.filter((s) => s.status === "active")),
          load: () => Promise.resolve(),
          setEnabled: () => Promise.resolve(),
          delete: () => Promise.resolve(),
        },
      },
      {
        provide: DaemonsService,
        useValue: {
          daemons$: of([] as AccessConnector[]),
          forgetTargetSystem: () => {},
          assign: () => Promise.resolve(),
        },
      },
    ],
  });
}

/**
 * Mirrors `rotation.routes.ts` (minus its guards) so the tab reads `organizationId` from a real
 * route param. The component declares no selector, so the story renders it through the outlet.
 */
const routes: Routes = [
  {
    path: "organizations/:organizationId/pam/rotation",
    children: [{ path: "target-systems", component: TargetSystemsTabComponent }],
  },
];

export default {
  title: "Web/PAM/Rotation/Target Systems Tab",
  component: TargetSystemsTabComponent,
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  decorators: [
    componentWrapperDecorator((story) => `<div class="tw-p-6">${story}</div>`),
    atUrl(`/organizations/${ORGANIZATION_ID}/pam/rotation/target-systems`),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter(routes, withHashLocation()),
        { provide: ToastService, useValue: { showToast: () => {} } },
        { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
      ],
    }),
  ],
} as Meta<TargetSystemsTabComponent>;

type Story = StoryObj<TargetSystemsTabComponent>;

/** The full toolbar: search plus the Method, Kind and Status chips, each with options to pick. */
export const Default: Story = {
  decorators: [rotationServices(SYSTEMS)],
};

/** No target systems configured yet, so the starter-template empty state replaces the table. */
export const Empty: Story = {
  decorators: [rotationServices([])],
};
