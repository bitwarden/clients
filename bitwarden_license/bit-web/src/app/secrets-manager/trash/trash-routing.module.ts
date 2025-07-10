import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { TrashComponent } from "./trash.component";

const routes: Routes = [
  {
    path: "",
    component: TrashComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TrashRoutingModule {}
