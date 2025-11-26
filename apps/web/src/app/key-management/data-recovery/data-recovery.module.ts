import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";

import { SharedModule } from "../../shared";

import { DataRecoveryComponent } from "./data-recovery.component";

@NgModule({
  imports: [CommonModule, SharedModule],
  declarations: [DataRecoveryComponent],
  exports: [DataRecoveryComponent],
})
export class DataRecoveryModule {}
