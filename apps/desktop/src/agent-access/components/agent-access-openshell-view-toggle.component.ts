import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { Router } from "@angular/router";

import { ToggleGroupModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export type OpenShellView = "sandboxes" | "environments";

/** Route of the environments view. A leading underscore can never be a sandbox name, so it can't shadow `:name`. */
export const OPENSHELL_ENVIRONMENTS_ROUTE = "/agent-access/openshell/_environments";
export const OPENSHELL_SANDBOXES_ROUTE = "/agent-access/openshell";

/**
 * The "Sandboxes | Environments" switch at the top of the OpenShell list page and the environments
 * page (agent-access-architecture.md, §M8.20 rule 17). Each view is its own route, so the switch
 * navigates and the current view is an input.
 */
@Component({
  selector: "app-agent-access-openshell-view-toggle",
  template: `
    <bit-toggle-group
      [selected]="view()"
      (selectedChange)="select($event)"
      [label]="'agentAccessOsViewLabel' | i18n"
    >
      <bit-toggle value="sandboxes" data-testid="openshell-view-sandboxes">{{
        "agentAccessOsViewSandboxes" | i18n
      }}</bit-toggle>
      <bit-toggle value="environments" data-testid="openshell-view-environments">{{
        "agentAccessOsViewEnvironments" | i18n
      }}</bit-toggle>
    </bit-toggle-group>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18nPipe, ToggleGroupModule],
})
export class AgentAccessOpenShellViewToggleComponent {
  private readonly router = inject(Router);

  readonly view = input.required<OpenShellView>();

  protected select(value: OpenShellView | undefined): void {
    if (value == null || value === this.view()) {
      return;
    }
    void this.router.navigate([
      value === "environments" ? OPENSHELL_ENVIRONMENTS_ROUTE : OPENSHELL_SANDBOXES_ROUTE,
    ]);
  }
}
