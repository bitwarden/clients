import { Routes } from "@angular/router";

import { AccessConnectorsService } from "./access-connectors/access-connectors.service";
import { RotationConfigsService } from "./managed-credentials/rotation-configs.service";
import { OrgCiphersService } from "./org-ciphers.service";
import { RotationShellComponent } from "./rotation-shell.component";
import { TargetSystemsService } from "./target-systems/target-systems.service";

/**
 * Form and detail pages are siblings of the shell, with their own header and no tab bar. The
 * shell route provides the page-scoped services, so the shell and its tabs share one load.
 */
export const rotationRoutes: Routes = [
  {
    path: "",
    component: RotationShellComponent,
    providers: [
      RotationConfigsService,
      TargetSystemsService,
      AccessConnectorsService,
      OrgCiphersService,
    ],
    children: [],
  },
];
