import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";

import { BitSvg, DevicesIcon } from "@bitwarden/assets/svg";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  IconButtonModule,
  IconComponent,
  NoItemsModule,
  SkeletonComponent,
  SkeletonGroupComponent,
  SkeletonTextComponent,
  SvgComponent,
  TableModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AGENT_LOGOS } from "../icons";
import { AgentAccessGrant } from "../models/agent-access-grant";
import { AgentAccessPageStateService } from "../services/agent-access-page-state.service";
import { resolveAgentBrand } from "../utils/agent-brand.util";

/** The two napi `SignatureKindData` members that carry an actual verified code signature.
 *  Mirrors `FirstUseAuthorizationDialogComponent`'s `VERIFIABLE_SIGNATURE_KIND` — kept as local
 *  string literals rather than a shared import for the same reason cited there: no runtime JS
 *  value exists to import from the ambient napi `const enum`. A grant's `signatureKind` is either
 *  one of these two, or `PATH_SIGNATURE_KIND` ("path") for unsigned/invalid/unresolved peers, per
 *  `deriveAgentAccessAttestationKey` (utils/agent-access-attestation.util.ts). */
const VERIFIABLE_SIGNATURE_KIND = Object.freeze({
  MacosTeamId: "macosTeamId",
  WindowsPublisher: "windowsPublisher",
} as const);

/** Which descriptor line the template renders for a grant. Mirrors
 *  `FirstUseAuthorizationDialogComponent.descriptorKind` so a grant is described the same way it
 *  was described in the first-use prompt that created it. */
type SignatureDescriptorKind = "signedBy" | "publishedBy" | "path";

/**
 * Primary content of the Agent Access page's "agents" tab: locally connected agents, sourced from
 * the grant store rather than the relay's connection list (agent-access-architecture.md,
 * "M2 — onboarding" — "Connected local agents... are the primary list content; remote paired
 * agents are secondary"). A grant here doesn't mean an agent is currently running — it means it
 * was authorized once via `FirstUseAuthorizationDialogComponent` and every request it makes still
 * goes through the normal per-request approval dialog.
 *
 * Reads `grants`/`grantsLoading` from `AgentAccessPageStateService` rather than calling
 * `ipc.agentAccess.listGrants()` itself — the same grant count also decides whether the parent tab
 * (`AgentAccessAgentsComponent`) shows its header CTA, so the fetch is shared rather than
 * duplicated.
 *
 * The empty state carries the "Connect an agent" CTA linking to the Setup tab; the parent shows the
 * equivalent header CTA only once this list is non-empty, so exactly one of the two is ever
 * visible.
 */
@Component({
  selector: "app-agent-access-connected-agents",
  templateUrl: "agent-access-connected-agents.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    I18nPipe,
    RouterLink,
    AsyncActionsModule,
    ButtonModule,
    IconButtonModule,
    IconComponent,
    NoItemsModule,
    SkeletonComponent,
    SkeletonGroupComponent,
    SkeletonTextComponent,
    SvgComponent,
    TableModule,
    TypographyModule,
  ],
})
export class AgentAccessConnectedAgentsComponent {
  private readonly dialogService = inject(DialogService);
  protected readonly pageState = inject(AgentAccessPageStateService);

  /** Empty-state icon for the connected-agents list. */
  protected readonly DevicesIcon = DevicesIcon;

  /** Placeholder rows shown by the skeleton while grants load. */
  protected readonly skeletonRows = [0, 1];

  /** See {@link SignatureDescriptorKind}: `"signedBy"`/`"publishedBy"` only for a real verified
   *  code signature; every unsigned/invalid/unresolved peer falls back to `"path"`, matching how
   *  the grant itself was keyed. Also doubles as this component's only notion of "was the
   *  signature valid" (see `brandLogo`): a grant has no `signatureValid` field of its own, but
   *  `deriveAgentAccessAttestationKey` (utils/agent-access-attestation.util.ts) only keys on
   *  `signatureKind` other than `PATH_SIGNATURE_KIND` ("path") when the attested signature was
   *  valid, so "not path" and "was valid" are the same fact. */
  protected descriptorKind(grant: AgentAccessGrant): SignatureDescriptorKind {
    if (grant.signatureKind === VERIFIABLE_SIGNATURE_KIND.MacosTeamId) {
      return "signedBy";
    }
    if (grant.signatureKind === VERIFIABLE_SIGNATURE_KIND.WindowsPublisher) {
      return "publishedBy";
    }
    return "path";
  }

  /** Value shown in the descriptor: the signature identity (already path-shaped for unsigned
   *  grants, per `deriveAgentAccessAttestationKey`'s docs) if present, else the exe path. */
  protected descriptorValue(grant: AgentAccessGrant): string {
    return grant.signatureIdentity || grant.exePath || "";
  }

  /** Brand mark for the row's leading icon tile; `undefined` renders the neutral fallback glyph
   *  instead (template). Decoration only — never a trust signal, per `resolveAgentBrand`'s docs.
   *  `AgentAccessGrant` carries no `signatureValid` field, so it's derived from `descriptorKind`
   *  rather than assumed: only `"signedBy"`/`"publishedBy"` (i.e. not `"path"`) means the grant
   *  was actually keyed on a verified signature (see `descriptorKind`'s doc). A `"path"` grant
   *  always renders the neutral fallback, matching `FirstUseAuthorizationDialogComponent`'s
   *  `brandLogo`. */
  protected brandLogo(grant: AgentAccessGrant): BitSvg | undefined {
    const brand = resolveAgentBrand({
      signatureKind: grant.signatureKind,
      signatureIdentity: grant.signatureIdentity,
      signatureValid: this.descriptorKind(grant) !== "path",
    });
    return brand == null ? undefined : AGENT_LOGOS[brand];
  }

  protected lastUsedDate(grant: AgentAccessGrant): Date {
    return new Date(grant.lastUsedAt * 1000);
  }

  // Angular template expressions can't contain arrow-function literals, so bitAction (which binds
  // to a zero-arg callable) is fed a closure built here rather than `() => removeGrant(g)` inline
  // in the template — same pattern as `AgentAccessAgentsComponent.removeConnectionAction`.
  protected removeGrantAction(grant: AgentAccessGrant) {
    return () => this.removeGrant(grant);
  }

  private async removeGrant(grant: AgentAccessGrant): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "agentAccessRemoveAgent" },
      content: grant.displayName,
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    await ipc.agentAccess.removeGrant(grant.id);
    await this.pageState.refreshGrants();
  }
}
