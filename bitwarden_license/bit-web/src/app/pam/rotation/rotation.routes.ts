import { RunGuardsAndResolvers, Routes } from "@angular/router";

import {
  AccessConnectorDetailComponent,
  accessConnectorDetailDiscardGuard,
} from "./access-connectors/access-connector-detail.component";
import { AccessConnectorsTabComponent } from "./access-connectors/access-connectors-tab.component";
import { AccessConnectorsService } from "./access-connectors/access-connectors.service";
import { ManagedCredentialsTabComponent } from "./managed-credentials/managed-credentials-tab.component";
import {
  RotationConfigEditComponent,
  rotationConfigEditDiscardGuard,
} from "./managed-credentials/rotation-config-edit.component";
import { RotationConfigsService } from "./managed-credentials/rotation-configs.service";
import { OrgCiphersService } from "./org-ciphers.service";
import { ROTATION_TABS } from "./rotation-links";
import { RotationShellComponent } from "./rotation-shell.component";
import {
  TargetSystemEditComponent,
  targetSystemEditDiscardGuard,
} from "./target-systems/target-system-edit.component";
import { TargetSystemsTabComponent } from "./target-systems/target-systems-tab.component";
import { TargetSystemsService } from "./target-systems/target-systems.service";

/** Whether a navigation off a detail page leaves the record it was editing behind. */
const recordChanged =
  (param: string): RunGuardsAndResolvers =>
  (from, to) =>
    from.params[param] !== to.params[param];

/**
 * Form and detail pages are siblings of the shell, with their own header and no tab bar. The
 * shell route provides the page-scoped services, so the shell and its tabs share one load.
 */
export const rotationRoutes: Routes = [
  // Declared before the shell so literal paths win over its catch-all ("").
  {
    path: `${ROTATION_TABS.managedCredentials}/new`,
    component: RotationConfigEditComponent,
    canDeactivate: [rotationConfigEditDiscardGuard],
    data: { titleId: "pamRotationConfigCreateTitle" },
  },
  // The edit page's tabs are routed, so each is deep-linkable. Angular reuses the component
  // across a `:tab` change, so a tab switch keeps unsaved input without a reload.
  {
    path: `${ROTATION_TABS.managedCredentials}/:configId`,
    pathMatch: "full",
    redirectTo: `${ROTATION_TABS.managedCredentials}/:configId/configuration`,
  },
  {
    path: `${ROTATION_TABS.managedCredentials}/:configId/:tab`,
    component: RotationConfigEditComponent,
    canDeactivate: [rotationConfigEditDiscardGuard],
    runGuardsAndResolvers: recordChanged("configId"),
    data: { titleId: "pamRotationConfigEditTitle" },
  },
  {
    path: `${ROTATION_TABS.targetSystems}/new`,
    component: TargetSystemEditComponent,
    canDeactivate: [targetSystemEditDiscardGuard],
    data: { titleId: "pamTargetSystemCreateTitle" },
  },
  {
    path: `${ROTATION_TABS.targetSystems}/:targetSystemId`,
    component: TargetSystemEditComponent,
    canDeactivate: [targetSystemEditDiscardGuard],
    data: { titleId: "pamTargetSystemEditTitle" },
  },
  {
    path: `${ROTATION_TABS.accessConnectors}/:accessConnectorId`,
    pathMatch: "full",
    redirectTo: `${ROTATION_TABS.accessConnectors}/:accessConnectorId/configuration`,
  },
  {
    path: `${ROTATION_TABS.accessConnectors}/:accessConnectorId/:tab`,
    component: AccessConnectorDetailComponent,
    canDeactivate: [accessConnectorDetailDiscardGuard],
    runGuardsAndResolvers: recordChanged("accessConnectorId"),
    data: { titleId: "pamAccessConnectorDetailTitle" },
  },
  {
    path: "",
    component: RotationShellComponent,
    providers: [
      RotationConfigsService,
      TargetSystemsService,
      AccessConnectorsService,
      OrgCiphersService,
    ],
    children: [
      { path: "", pathMatch: "full", redirectTo: ROTATION_TABS.accessConnectors },
      {
        path: ROTATION_TABS.accessConnectors,
        component: AccessConnectorsTabComponent,
        data: { titleId: "pamRotationTabAccessConnectors" },
      },
      {
        path: ROTATION_TABS.targetSystems,
        component: TargetSystemsTabComponent,
        data: { titleId: "pamRotationTabTargetSystems" },
      },
      {
        path: ROTATION_TABS.managedCredentials,
        component: ManagedCredentialsTabComponent,
        data: { titleId: "pamRotationTabManagedCredentials" },
      },
    ],
  },
];
