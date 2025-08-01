import { Routes } from "@angular/router";

import { AnonLayoutWrapperData } from "@bitwarden/components";
import { ActiveSendIcon } from "@bitwarden/send-ui";

import { RouteDataProperties } from "../../../core";

import { SendAccessExplainerComponent } from "./send-access-explainer.component";
import { SendAccessPasswordComponent } from "./send-access-password.component";
import { trySendAccess } from "./try-send-access.guard";

/** Routes to reach send access screens */
export const SendAccessRoutes: Routes = [
  {
    path: "send/:sendId",
    // there are no child pages because `trySendAccess` always performs a redirect
    canActivate: [trySendAccess],
  },
  {
    path: "send/password/:sendId",
    data: {
      pageTitle: {
        key: "sendAccessPasswordTitle",
      },
      pageIcon: ActiveSendIcon,
      showReadonlyHostname: true,
    } satisfies RouteDataProperties & AnonLayoutWrapperData,
    children: [
      {
        path: "",
        component: SendAccessPasswordComponent,
      },
      {
        path: "",
        outlet: "secondary",
        component: SendAccessExplainerComponent,
      },
    ],
  },
  {
    path: "send/content/:sendId",
    data: {
      pageTitle: {
        key: "sendAccessContentTitle",
      },
      pageIcon: ActiveSendIcon,
      showReadonlyHostname: true,
    } satisfies RouteDataProperties & AnonLayoutWrapperData,
    children: [
      {
        path: "send/password/:sendId",
      },
      {
        path: "",
        outlet: "secondary",
        component: SendAccessExplainerComponent,
      },
    ],
  },
];
