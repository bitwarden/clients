// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import {
  Component,
  DestroyRef,
  inject,
  Input,
  OnChanges,
  signal,
  SimpleChanges,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SshKeyView } from "@bitwarden/common/vault/models/view/ssh-key.view";
import {
  SectionHeaderComponent,
  TypographyModule,
  FormFieldModule,
  IconButtonModule,
} from "@bitwarden/components";

import { SshAgentKeySettings } from "../../cipher-form/abstractions/ssh-agent-settings";
import { ReadOnlyCipherCardComponent } from "../read-only-cipher-card/read-only-cipher-card.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-sshkey-view",
  templateUrl: "sshkey-view.component.html",
  imports: [
    CommonModule,
    JslibModule,
    SectionHeaderComponent,
    ReadOnlyCipherCardComponent,
    TypographyModule,
    FormFieldModule,
    IconButtonModule,
  ],
})
export class SshKeyViewComponent implements OnChanges {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() sshKey: SshKeyView;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() cipherId: string;

  revealSshKey = false;

  private sshAgentKeySettings = inject(SshAgentKeySettings, { optional: true });
  private destroyRef = inject(DestroyRef);
  readonly showAgentStatus = signal(false);
  readonly agentEnabled = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["sshKey"]) {
      this.revealSshKey = false;
    }
    if (changes["cipherId"] && this.cipherId && this.sshAgentKeySettings) {
      this.showAgentStatus.set(true);
      this.sshAgentKeySettings
        .isKeyEnabledForAgent$(this.cipherId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((enabled) => {
          this.agentEnabled.set(enabled);
        });
    }
  }
}
