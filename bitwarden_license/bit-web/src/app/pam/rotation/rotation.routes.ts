import { RunGuardsAndResolvers, Routes } from "@angular/router";

import { DaemonDetailComponent, daemonDetailDiscardGuard } from "./daemons/daemon-detail.component";
import { DaemonsTabComponent } from "./daemons/daemons-tab.component";
import { DaemonsService } from "./daemons/daemons.service";
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
 * Rotation feature routes, lazy-loaded by {@link PamRoutingModule} under `rotation/`.
 *
 * Form pages are siblings of the shell (own header/breadcrumbs, no tab bar) —
 * matching the access-rules precedent. The shell provides its page-scoped services
 * so the shell and every tab share one loaded instance.
 */
export const rotationRoutes: Routes = [
  // Form pages: siblings of the shell, declared first so literal paths win over
  // the shell catch-all ("")
  {
    path: `${ROTATION_TABS.managedCredentials}/new`,
    component: RotationConfigEditComponent,
    canDeactivate: [rotationConfigEditDiscardGuard],
    data: { titleId: "pamRotationConfigCreateTitle" },
  },
  // The edit page's two tabs are routed, so each is deep-linkable and survives a refresh. Both
  // land on the same component, which reads `:tab` and renders that half; Angular reuses the
  // instance across the param change, so a tab switch costs no reload and keeps unsaved input.
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
    path: `${ROTATION_TABS.accessConnectors}/:daemonId`,
    pathMatch: "full",
    redirectTo: `${ROTATION_TABS.accessConnectors}/:daemonId/configuration`,
  },
  {
    path: `${ROTATION_TABS.accessConnectors}/:daemonId/:tab`,
    component: DaemonDetailComponent,
    canDeactivate: [daemonDetailDiscardGuard],
    runGuardsAndResolvers: recordChanged("daemonId"),
    data: { titleId: "pamAccessConnectorDetailTitle" },
  },
  {
    path: "",
    component: RotationShellComponent,
    providers: [RotationConfigsService, TargetSystemsService, DaemonsService, OrgCiphersService],
    children: [
      { path: "", pathMatch: "full", redirectTo: ROTATION_TABS.accessConnectors },
      {
        path: ROTATION_TABS.accessConnectors,
        component: DaemonsTabComponent,
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
