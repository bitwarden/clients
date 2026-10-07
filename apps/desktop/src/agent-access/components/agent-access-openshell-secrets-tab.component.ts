import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";

import { AgentAccessOpenShellCredentialsComponent } from "./agent-access-openshell-credentials.component";

/** "Secrets" tab of a sandbox: the vault logins and secrets it can use. The name comes from the parent route. */
@Component({
  selector: "app-agent-access-openshell-secrets-tab",
  template: `
    @if (name(); as sandboxName) {
      <app-agent-access-openshell-credentials [sandboxName]="sandboxName" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgentAccessOpenShellCredentialsComponent],
})
export class AgentAccessOpenShellSecretsTabComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly name = toSignal(
    this.route.parent.paramMap.pipe(map((params) => params.get("name"))),
    { initialValue: this.route.parent.snapshot.paramMap.get("name") },
  );
}
