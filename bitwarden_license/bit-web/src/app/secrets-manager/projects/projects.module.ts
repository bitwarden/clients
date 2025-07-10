import { NgModule } from "@angular/core";

import { BreadcrumbsModule } from "@bitwarden/components";

import { SecretsManagerSharedModule } from "../shared/sm-shared.module";

import { ProjectDeleteDialogComponent } from "./dialog/project-delete-dialog.component";
import { ProjectDialogComponent } from "./dialog/project-dialog.component";
import { ProjectPeopleComponent } from "./project/project-people.component";
import { ProjectSecretsComponent } from "./project/project-secrets.component";
import { ProjectServiceAccountsComponent } from "./project/project-service-accounts.component";
import { ProjectComponent } from "./project/project.component";
import { ProjectsComponent } from "./projects/projects.component";
import { ProjectsRoutingModule } from "./projects-routing.module";

@NgModule({
  imports: [SecretsManagerSharedModule, ProjectsRoutingModule, BreadcrumbsModule],
  declarations: [
    ProjectsComponent,
    ProjectDialogComponent,
    ProjectDeleteDialogComponent,
    ProjectPeopleComponent,
    ProjectServiceAccountsComponent,
    ProjectComponent,
    ProjectSecretsComponent,
  ],
  providers: [],
})
export class ProjectsModule {}
