import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";

import {
  ButtonModule,
  CalloutModule,
  DialogModule,
  FormFieldModule,
  SearchModule,
  SwitchComponent,
} from "@bitwarden/components";

import { DebugFeatureFlagDialogService } from "./debug-feature-flag-dialog.service";

@Component({
  selector: "app-debug-feature-flag-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    DialogModule,
    ButtonModule,
    CalloutModule,
    SearchModule,
    SwitchComponent,
    FormFieldModule,
  ],
  templateUrl: "./debug-feature-flag-dialog.component.html",
})
export class DebugFeatureFlagDialogComponent implements OnInit {
  protected readonly service = inject(DebugFeatureFlagDialogService);

  async ngOnInit(): Promise<void> {
    await this.service.initialize();
  }
}
