import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, I18nMockService, ToastService } from "@bitwarden/components";

import { AccessConnector, TargetSystem } from "../rotation";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import { ORGANIZATION_ID, accessConnector, connectorId, sysId } from "../testing/rotation-builders";

import { AccessConnectorsTabComponent } from "./access-connectors-tab.component";
import { AccessConnectorRow, AccessConnectorsService } from "./access-connectors.service";

function row(accessConnector: AccessConnector, assignmentNames: string[] = []): AccessConnectorRow {
  return {
    id: accessConnector.id,
    name: accessConnector.name,
    statusLabelKey:
      accessConnector.status === "enabled"
        ? "pamAccessConnectorStatusActive"
        : "pamAccessConnectorStatusInactive",
    isConnected: accessConnector.isConnected,
    assignmentNames,
    enabled: accessConnector.status === "enabled",
    canAssign: accessConnector.status === "enabled",
    accessConnector,
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

const CONNECTOR_SHARED = accessConnector({
  id: connectorId("connector-shared"),
  name: "Shared services connector",
  assignedTargetSystemIds: [sysId("1")],
});

const ROWS: AccessConnectorRow[] = [
  row(CONNECTOR_PROD, ["Prod Entra"]),
  row(CONNECTOR_EU, ["Prod Entra", "Reporting SQL"]),
  row(CONNECTOR_STAGING, []),
  row(CONNECTOR_SHARED, [
    "Prod Entra",
    "Reporting SQL",
    "Billing MSSQL",
    "Partner API script",
    "Legacy LDAP",
    "Warehouse Postgres",
  ]),
];

function rotationServices(rows: AccessConnectorRow[]) {
  return moduleMetadata({
    providers: [
      {
        provide: AccessConnectorsService,
        useValue: {
          loading$: of(false),
          loadError$: of(null),
          rows$: of(rows),
          accessConnectors$: of(rows.map((r) => r.accessConnector)),
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
          automaticSystems$: of([{ id: sysId("1") }] as TargetSystem[]),
          loading$: of(false),
          loadError$: of(null),
          load: () => Promise.resolve(),
        },
      },
    ],
  });
}

export default {
  title: "Web/PAM/Rotation/Access Connectors Tab",
  component: AccessConnectorsTabComponent,
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
              search: "Search",
              resetSearch: "Reset search",
              pamAccessConnectorSearch: "Search access connectors",
              pamAccessConnectorEmptyStateTitle: "No access connectors registered",
              pamAccessConnectorEmptyStateDescription:
                "Register an access connector to start rotating credentials.",
              pamAccessConnectorNew: "New access connector",
              pamAccessConnectorConnection: "Connection",
              pamAccessConnectorAssignments: "Assigned targets",
              pamAccessConnectorAssignmentCountSingular: "__$1__ target",
              pamAccessConnectorAssignmentCount: "__$1__ targets",
              pamAccessConnectorAssignmentsNone: "None",
              close: "Close",
              pamAccessConnectorConnected: "Connected",
              pamAccessConnectorDisconnected: "Disconnected",
              pamAccessConnectorViewDetails: "View details",
              pamAccessConnectorAssignTargets: "Assign targets",
              pamAccessConnectorAssignNoOptions:
                "All active automatic target systems are already assigned to this access connector.",
              pamAccessConnectorAssignNoTargetSystems:
                "There are no active automatic target systems to assign. Create one on the Target systems tab, or activate an existing one.",
              pamAccessConnectorUnassign: "Remove __$1__",
              pamAccessConnectorDeactivate: "Deactivate",
              pamAccessConnectorActivate: "Activate",
              pamAccessConnectorDeleteAccessConnector: "Delete access connector",
              pamAccessConnectorNoResults: "No access connectors match your search.",
              pamAccessConnectorStatusActive: "Active",
              pamAccessConnectorStatusInactive: "Inactive",
            }),
        },
        { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
        { provide: ToastService, useValue: { showToast: () => {} } },
      ],
    }),
  ],
} as Meta<AccessConnectorsTabComponent>;

type Story = StoryObj<AccessConnectorsTabComponent>;

export const Default: Story = {
  decorators: [rotationServices(ROWS)],
};

/** No access connectors have been registered yet. */
export const Empty: Story = {
  decorators: [rotationServices([])],
};
