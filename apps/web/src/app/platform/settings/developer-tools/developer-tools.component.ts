import { Component } from "@angular/core";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";

@Component({
  selector: "app-developer-tools",
  templateUrl: "./developer-tools.component.html",
  imports: [SharedModule, HeaderModule],
})
export class DeveloperToolsComponent {}
