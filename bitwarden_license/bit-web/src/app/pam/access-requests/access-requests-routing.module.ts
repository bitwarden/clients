import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { AccessNameResolverService } from "./access-name-resolver.service";
import { AccessRequestsComponent } from "./access-requests.component";
import { MyAccessService } from "./my-access.service";
import { MyRequestsTabComponent } from "./my-requests-tab.component";

const routes: Routes = [
  {
    path: "",
    component: AccessRequestsComponent,
    // On the shell route so every tab shares one instance; routed children inherit a parent
    // route's providers, not a component's.
    providers: [AccessNameResolverService, MyAccessService],
    children: [
      { path: "", pathMatch: "full", redirectTo: "my-requests" },
      {
        path: "my-requests",
        component: MyRequestsTabComponent,
        data: { titleId: "pamTabMyRequests" },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AccessRequestsRoutingModule {}
