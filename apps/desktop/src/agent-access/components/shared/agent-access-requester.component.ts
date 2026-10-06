import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import type { BitSvg } from "@bitwarden/assets/svg";
import { IconComponent, SvgComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Shape a caller hands to `app-agent-access-requester`. Deliberately a plain view model rather
 * than the raw attestation payload (`signatureKind` / `signatureIdentity` / `signatureValid`,
 * see `utils/agent-brand.util.ts`): resolving *which* descriptor sentence to show — "Signed by
 * X" vs. "Published by X" vs. "Running from Y" — is per-dialog i18n logic (mirrors
 * `first-use-authorization-dialog.component.ts`'s `descriptorKind`), so it stays with each
 * dialog. This component only renders the already-resolved result.
 */
export interface AgentAccessRequesterView {
  /** Resolved display name — a recognized agent's product name, or the attested process name. */
  readonly name: string;
  /** Already-localized descriptor line, e.g. "Signed by Anthropic, Inc." or "Running from
   *  /usr/local/bin/x". Omitted renders no second line. */
  readonly descriptor?: string;
  /** Brand mark from `AGENT_LOGOS`, resolved via `resolveAgentBrand` — only ever set for a
   *  *verified* signature. `undefined` renders the neutral `bwi-terminal` glyph instead, so an
   *  unrecognized or unsigned requester can never borrow a familiar logo. */
  readonly brandLogo?: BitSvg;
  /** True only when a signature was captured but explicitly failed verification — renders the
   *  "could not be verified" warning strip. Defaults to false. */
  readonly unverified?: boolean;
}

/**
 * WHO is asking — the identity block every Agent Access approval dialog leads with
 * (agent-access-design-spec.md §2 — "who is asking" is answered first, always in the same
 * place). Promoted out of `first-use-authorization-dialog.component.html:8–37`, which had the
 * only good version of this block in the family (see spec §1, fault 3); the visual structure and
 * behaviour here are unchanged, only the descriptor text is now a pre-resolved input instead of
 * being switched on locally (see `AgentAccessRequesterView`'s doc comment for why).
 */
@Component({
  selector: "app-agent-access-requester",
  templateUrl: "./agent-access-requester.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SvgComponent, TypographyModule, I18nPipe],
})
export class AgentAccessRequesterComponent {
  /** Resolved display name — a recognized agent's product name, or the attested process name. */
  readonly name = input.required<string>();

  /** Already-localized descriptor line, e.g. "Signed by Anthropic, Inc." or "At /usr/local/bin/x". */
  readonly descriptor = input<string>();

  /** Brand mark; `undefined` renders the neutral `bwi-terminal` glyph instead. */
  readonly brandLogo = input<BitSvg | undefined>(undefined);

  /** Renders the "signature could not be verified" warning strip when true. */
  readonly unverified = input(false);
}
