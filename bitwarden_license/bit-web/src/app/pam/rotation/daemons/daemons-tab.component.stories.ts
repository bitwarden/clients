import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, I18nMockService, ToastService } from "@bitwarden/components";

import { AccessConnector, TargetSystem } from "../rotation";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import { ORGANIZATION_ID, accessConnector, connectorId, sysId } from "../testing/rotation-builders";

import { DaemonsTabComponent } from "./daemons-tab.component";
import { DaemonRow, DaemonsService } from "./daemons.service";

function row(daemon: AccessConnector, assignmentNames: string[] = []): DaemonRow {
  return {
    id: daemon.id,
    name: daemon.name,
    statusLabelKey:
      daemon.status === "enabled"
        ? "pamAccessConnectorStatusEnabled"
        : "pamAccessConnectorStatusDisabled",
    isConnected: daemon.isConnected,
    assignmentNames,
    enabled: daemon.status === "enabled",
    canAssign: daemon.status === "enabled",
    daemon,
  };
}

const CONNECTOR_PROD = accessConnector({
  id: connectorId("connector-prod"),
  name: "Prod on-prem connector",
  assignedTargetSystemIds: [sysId("1")],
});

const CONNECTOR_EU = accessConnector({
  id: connectorId("connector-eu"),
  name: "EU region connector",
  isConnected: false,
});

const CONNECTOR_STAGING = accessConnector({
  id: connectorId("connector-staging"),
  name: "Staging connector",
  status: "disabled",
  isConnected: false,
});

const ROWS: DaemonRow[] = [
  row(CONNECTOR_PROD, ["Prod Entra"]),
  row(CONNECTOR_EU, ["Prod Entra", "Reporting SQL"]),
  row(CONNECTOR_STAGING, []),
];

function rotationServices(rows: DaemonRow[]) {
  return moduleMetadata({
    providers: [
      {
        provide: DaemonsService,
        useValue: {
          loading$: of(false),
          rows$: of(rows),
          daemons$: of(rows.map((r) => r.daemon)),
          load: () => Promise.resolve(),
          registerCompleted: () => Promise.resolve(),
          assign: () => Promise.resolve(),
          unassign: () => Promise.resolve(),
          setEnabled: () => Promise.resolve(),
          delete: () => Promise.resolve(),
        },
      },
      {
        provide: TargetSystemsService,
        useValue: {
          activeAutomaticSystems$: of([{ id: sysId("1") }] as TargetSystem[]),
          load: () => Promise.resolve(),
        },
      },
    ],
  });
}

export default {
  title: "Web/PAM/Rotation/Access Connectors Tab",
  component: DaemonsTabComponent,
  decorators: [
    applicationConfig({
      providers: [
        importProvidersFrom(RouterModule.forRoot([])),
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: ORGANIZATION_ID }) },
        },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              delete: "Delete",
              name: "Name",
              status: "Status",
              all: "All",
              options: "Options",
              removeItem: "Remove __$1__",
              pamAccessConnectorSearch: "Search access connectors",
              pamAccessConnectorEmptyStateTitle: "No access connectors registered",
              pamAccessConnectorEmptyStateDescription:
                "Register an access connector to start rotating credentials.",
              pamAccessConnectorNew: "New access connector",
              pamAccessConnectorConnection: "Connection",
              pamAccessConnectorAssignments: "Assigned targets",
              pamAccessConnectorConnected: "Connected",
              pamAccessConnectorOffline: "Offline",
              pamAccessConnectorViewDetails: "View details",
              pamAccessConnectorAssignTargets: "Assign targets",
              pamAccessConnectorUnassign: "Remove __$1__",
              pamAccessConnectorDisable: "Disable",
              pamAccessConnectorEnable: "Enable",
              pamAccessConnectorDeleteAccessConnector: "Delete access connector",
              pamAccessConnectorNoResults: "No access connectors match your search.",
              pamAccessConnectorStatusEnabled: "Enabled",
              pamAccessConnectorStatusDisabled: "Disabled",
            }),
        },
        { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
        { provide: ToastService, useValue: { showToast: () => {} } },
      ],
    }),
  ],
} as Meta<DaemonsTabComponent>;

type Story = StoryObj<DaemonsTabComponent>;

/**
 * Both statuses and both connection states, so the Status and Connection chips each narrow the
 * table — including an enabled connector that is offline, which only one of them excludes.
 */
export const Default: Story = {
  decorators: [rotationServices(ROWS)],
};

/** No access connectors have been registered yet. */
export const Empty: Story = {
  decorators: [rotationServices([])],
};
