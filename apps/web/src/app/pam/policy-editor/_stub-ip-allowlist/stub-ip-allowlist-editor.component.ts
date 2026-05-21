import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  output,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { FormFieldModule } from "@bitwarden/components";

import { LeasingPolicy } from "@bitwarden/pam";

/**
 * SCAFFOLD ONLY — replace with the real PM-37273 component at demo-workspace integration.
 *
 * Renders a single textarea pre-filled with "10.0.0.0/8". Serializes to
 * `{ kind: "ip_allowlist", cidrs: [<user input>] }`.
 */
@Component({
  selector: "pam-stub-ip-allowlist-editor",
  templateUrl: "./stub-ip-allowlist-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, JslibModule, FormFieldModule],
})
export class StubIpAllowlistEditorComponent implements OnInit {
  /** Emitted whenever the serialized policy value changes. */
  readonly policyChange = output<LeasingPolicy>();

  protected readonly cidrText = signal("10.0.0.0/8");

  ngOnInit(): void {
    this.emit();
  }

  protected onCidrTextChange(value: string): void {
    this.cidrText.set(value);
    this.emit();
  }

  buildPolicy(): LeasingPolicy {
    const cidrs = this.cidrText()
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return { kind: "ip_allowlist", cidrs };
  }

  private emit(): void {
    this.policyChange.emit(this.buildPolicy());
  }
}
