import { Routes } from "@angular/router";

import { DaemonDetailComponent } from "./daemons/daemon-detail.component";
import { DaemonsTabComponent } from "./daemons/daemons-tab.component";
import { DaemonsService } from "./daemons/daemons.service";
import { ManagedCredentialsTabComponent } from "./managed-credentials/managed-credentials-tab.component";
import { RotationConfigEditComponent } from "./managed-credentials/rotation-config-edit.component";
import { RotationConfigsService } from "./managed-credentials/rotation-configs.service";
import { OrgCiphersService } from "./org-ciphers.service";
import { RotationShellComponent } from "./rotation-shell.component";
import { TargetSystemEditComponent } from "./target-systems/target-system-edit.component";
import { TargetSystemsTabComponent } from "./target-systems/target-systems-tab.component";
import { TargetSystemsService } from "./target-systems/target-systems.service";

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
    path: "managed-credentials/new",
    component: RotationConfigEditComponent,
    data: { titleId: "pamRotationConfigCreateTitle" },
  },
  {
    path: "managed-credentials/:configId",
    component: RotationConfigEditComponent,
    data: { titleId: "pamRotationConfigEditTitle" },
  },
  {
    path: "target-systems/new",
    component: TargetSystemEditComponent,
    data: { titleId: "pamTargetSystemCreateTitle" },
  },
  {
    path: "target-systems/:targetSystemId",
    component: TargetSystemEditComponent,
    data: { titleId: "pamTargetSystemEditTitle" },
  },
  {
    path: "daemons/:daemonId",
    component: DaemonDetailComponent,
    data: { titleId: "pamDaemonDetailTitle" },
  },
  // Shell: tabbed container that provides the page-scoped services
  {
    path: "",
    component: RotationShellComponent,
    providers: [RotationConfigsService, TargetSystemsService, DaemonsService, OrgCiphersService],
    children: [
      { path: "", pathMatch: "full", redirectTo: "managed-credentials" },
      {
        path: "managed-credentials",
        component: ManagedCredentialsTabComponent,
        data: { titleId: "pamRotationTabManagedCredentials" },
      },
      {
        path: "target-systems",
        component: TargetSystemsTabComponent,
        data: { titleId: "pamRotationTabTargetSystems" },
      },
      {
        path: "daemons",
        component: DaemonsTabComponent,
        data: { titleId: "pamRotationTabDaemons" },
      },
    ],
  },
];
