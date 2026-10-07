import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from "@angular/core";

import { StopClickDirective } from "@bitwarden/angular/directives/stop-click.directive";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AsyncActionsModule,
  BadgeComponent,
  BadgeVariant,
  ButtonModule,
  CalloutModule,
  CopyClickDirective,
  DisclosureComponent,
  DisclosureTriggerForDirective,
  FormControlModule,
  IconComponent,
  ItemModule,
  LinkModule,
  SectionComponent,
  SectionHeaderComponent,
  SkeletonComponent,
  SkeletonGroupComponent,
  SkeletonTextComponent,
  SvgComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AGENT_LOGOS } from "../icons";
import { AgentDetectionResult } from "../models/agent-detection";
import { AgentId } from "../models/agent-id";
import {
  buildInstallDeeplink,
  buildManualSetupCommand,
  McpRegistrationStrategyKind,
  RegisterWithAgentResult,
  RegisterWithAgentStatus,
} from "../models/agent-registration";
import { AgentRegistrationStatus } from "../models/agent-registration-status";
import { AgentDefinition, SUPPORTED_AGENTS } from "../models/agent-registry";
import { buildBitwardenMcpConfig } from "../models/mcp-config";
import { AgentAccessPageStateService } from "../services/agent-access-page-state.service";

/** Where users get the `aac` CLI when the bundled binary is missing (e.g. an unpackaged dev
 *  build). Duplicated from `AgentAccessPairAgentDialogComponent` rather than imported from it —
 *  that dialog is remote-pairing-specific and out of scope here; the URL itself is a generic
 *  "get the CLI" link shared by both entry points. */
const AGENT_ACCESS_SETUP_URL = "https://github.com/bitwarden/agent-access";

/** i18n key for each `RegisterWithAgentStatus` outcome, rendered inline on the agent's own card.
 *  Only ever populated for an agent whose card action actually calls `registerWithAgent` — a
 *  `FileMerge`-strategy agent's primary "Connect" button, or a `Deeplink`-strategy agent's
 *  declared-fallback secondary action (see `AgentCardAction` below). Every message is
 *  `$AGENT$`-parameterized (`agent-registration.ts`). */
const REGISTER_RESULT_MESSAGE_KEYS: Record<RegisterWithAgentStatus, string> = {
  [RegisterWithAgentStatus.Added]: "agentAccessRegisterAgentAdded",
  [RegisterWithAgentStatus.Updated]: "agentAccessRegisterAgentUpdated",
  [RegisterWithAgentStatus.AlreadyPresent]: "agentAccessRegisterAgentAlreadyPresent",
  [RegisterWithAgentStatus.Error]: "agentAccessRegisterAgentError",
};

/**
 * What one agent's card renders as its single primary action, derived from
 * `AgentDefinition.registrationStrategy.kind` (`models/agent-registration.ts`). There is one shape
 * per `McpRegistrationStrategyKind` because each mechanism needs a materially different affordance
 * — see the class doc below for why batching them behind one button no longer makes sense.
 *
 * `command`/`deeplinkUri` are `null` only while the bundled `aac` CLI path hasn't resolved (or
 * never will — see `aacPath` and the `aacPath() === null` warning callout): both are built from
 * it, so a card can't offer a real command/link without it. The card's button disables rather than
 * rendering a broken command or a deeplink with no server info.
 */
type AgentCardAction =
  | { kind: typeof McpRegistrationStrategyKind.ManualCommand; command: string | null }
  | {
      kind: typeof McpRegistrationStrategyKind.Deeplink;
      deeplinkUri: string | null;
      /** True for an agent whose `DeeplinkRegistrationStrategy` declares a `fallback` (only
       *  GitHub Copilot today, per `models/agent-registry.ts`). The card then also renders a
       *  second, explicitly-labelled action that writes the fallback config file directly —
       *  never automatically, since a failed deeplink gives no completion signal this app could
       *  react to (see `DeeplinkRegistrationStrategy.fallback`'s doc comment). */
      hasFallback: boolean;
    }
  | { kind: typeof McpRegistrationStrategyKind.FileMerge };

function buildAgentCardAction(
  definition: AgentDefinition,
  aacPath: string | null,
): AgentCardAction {
  const strategy = definition.registrationStrategy;
  switch (strategy.kind) {
    case McpRegistrationStrategyKind.ManualCommand:
      return {
        kind: McpRegistrationStrategyKind.ManualCommand,
        command: aacPath == null ? null : buildManualSetupCommand(strategy, aacPath),
      };
    case McpRegistrationStrategyKind.Deeplink:
      return {
        kind: McpRegistrationStrategyKind.Deeplink,
        deeplinkUri: aacPath == null ? null : buildInstallDeeplink(strategy, aacPath),
        hasFallback: strategy.fallback != null,
      };
    case McpRegistrationStrategyKind.FileMerge:
      return { kind: McpRegistrationStrategyKind.FileMerge };
    default: {
      // Exhaustiveness check: a new McpRegistrationStrategyKind was added without a case here.
      const unreachable: never = strategy;
      throw new Error(`Unhandled registration strategy: ${JSON.stringify(unreachable)}`);
    }
  }
}

/** A `SUPPORTED_AGENTS` entry paired with everything one card needs to render: whether it was
 *  detected on this machine, whether it's already registered (persistent, from
 *  `getAgentRegistrationStatuses()`), the action its card offers, and the outcome of the most
 *  recent `registerWithAgent` call for it, if any. */
interface SelectableAgent {
  definition: AgentDefinition;
  detected: boolean;
  /** True only when the read-only status query came back `registered`. `notRegistered` and
   *  `unknown` both render identically here (no badge) — `unknown` must never be presented as a
   *  false-negative "not connected". */
  connected: boolean;
  /** At most one status badge is ever shown per card — "Connected" implies "Detected", so showing
   *  both would be redundant. `null` when the agent is neither detected nor connected. */
  badge: { messageKey: string; variant: BadgeVariant } | null;
  action: AgentCardAction;
  /** i18n key for this agent's most recent `registerWithAgent` outcome, or `null` if its card
   *  action doesn't call `registerWithAgent` at all (`ManualCommand`, or a `Deeplink`'s primary
   *  button) or hasn't been used yet this session. */
  connectResultMessageKey: string | null;
  connectResultIsError: boolean;
}

/**
 * "Connect an agent" — one card per supported AI coding agent, each offering the single action
 * appropriate to how that agent's own CLI/app wants the Bitwarden MCP server registered
 * (agent-access-architecture.md, "M3 — multi-agent support"). Replaces the earlier multi-select
 * batch picker: batching stopped making sense once registration split into three different
 * mechanisms (`models/agent-registration.ts`) — you can't "batch" three different copy-paste
 * commands, and a checkbox implies a single uniform "connect" action that no longer exists.
 *
 * This rewrite exists because this app can no longer spawn an agent's own CLI to register itself.
 * A macOS app launched from the Dock inherits launchd's PATH (`/usr/bin:/bin:/usr/sbin:/sbin`),
 * not the user's shell PATH, so `claude`/`codex`/etc. were never found outside a terminal-launched
 * dev instance — see `models/agent-registration.ts`'s doc comment for the full story. Each agent's
 * card now offers exactly the mechanism its `registrationStrategy.kind` declares:
 *  - `ManualCommand` (Claude Code, Codex CLI, Gemini CLI): a copy-paste command the user runs in
 *    their *own* terminal, with their real PATH already loaded.
 *  - `Deeplink` (Cursor, GitHub Copilot): hands off to the vendor's own MCP install URI via
 *    `PlatformUtilsService.launchUri` — the vendor's app owns the confirmation UI.
 *  - `FileMerge`: this app writes the agent's JSON config itself, over IPC
 *    (`ipc.agentAccess.registerWithAgent`). Also used as a `Deeplink` agent's declared `fallback`
 *    (Copilot only) — an explicit secondary action, never an automatic retry, since a failed
 *    deeplink gives no completion signal this app could react to.
 *
 * Agents already detected on this machine (`ipc.agentAccess.detectAgents()`) are badged "Detected"
 * and sorted first. Agents the read-only registration query
 * (`ipc.agentAccess.getAgentRegistrationStatuses()`) reports as `registered` are badged
 * "Connected". Because `ManualCommand` and `Deeplink` both complete *outside this app's process*
 * (a terminal command, a vendor app's own install flow), that read-only status probe is the only
 * way this page can ever learn they worked — so it's re-run on window focus (the user tabbing back
 * in after running the command / completing the vendor flow) and behind an explicit "Refresh"
 * action, not just after a `FileMerge` write this app itself performed.
 *
 * The registration statuses themselves live in `AgentAccessPageStateService.registrationStatuses`,
 * not a private signal here — this component is the *only* thing that refreshes them (init,
 * "Refresh", window focus), but the Agents tab's setup checklist also needs to *read* them to
 * decide whether its "Connect an AI assistant" task is complete. One source of truth, refreshed in
 * one place, keeps this component (which is itself hosted inside that task's projected content
 * until it's complete) and the checklist from ever disagreeing about what "connected" means.
 *
 * The most important behavior carried over from the batch picker: a `registerWithAgent` call
 * reports *its own agent's own outcome on its own card* — a success message or an inline error —
 * never folded into an aggregate toast with no indication of which agent it was.
 *
 * A "My agent isn't listed" disclosure — collapsed by default, since it's the escape hatch, not
 * the default view — holds a raw MCP config (built from the bundled `aac` CLI path) for clients
 * not in the supported list, unchanged from the original hand-rolled version of this component.
 *
 * ## Layout
 *
 * Renders as a `bit-section` with a real `bit-section-header`, so it reads as a peer of the Setup
 * tab's "Agents on other devices" section rather than as a bare `<h2>` floating above an untitled
 * disclosure. Three things about the earlier grid were actively working against the task:
 *  - **Three columns.** A `ManualCommand` card's whole payload is a shell command; at a third of
 *    the page width it overflowed into a horizontal scrollbar inside the card. Two columns, and
 *    the command wraps (`whitespace-pre-wrap break-all`) instead of scrolling — the Copy button
 *    means the wrapped rendering never has to be selected by hand.
 *  - **Ragged card heights.** The three strategies produce very different card bodies (a command
 *    block and a button; one or two buttons; one button), and a grid row stretches to its tallest
 *    card, so short cards trailed dead space and no two buttons shared a baseline. Cards are now
 *    `h-full` columns with the action row pushed down by `mt-auto`.
 *  - **An icon-only Refresh.** Confirming an out-of-process step actually worked is a step in this
 *    flow, not an incidental utility, so it carries a visible label.
 *
 * No pairing, no token, no CLI ceremony: the agent launches `aac mcp` itself and the first request
 * it makes triggers `FirstUseAuthorizationDialogComponent`, unchanged by this component.
 */
@Component({
  selector: "app-agent-access-connect",
  templateUrl: "agent-access-connect.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // `ManualCommand`/`Deeplink` actions complete outside this app's process with no completion
    // signal it can observe directly — re-checking the read-only status probe when the user tabs
    // back in is the best available proxy for "did that work?". See the class doc.
    "(window:focus)": "onWindowFocus()",
  },
  imports: [
    AsyncActionsModule,
    BadgeComponent,
    ButtonModule,
    CalloutModule,
    CopyClickDirective,
    DisclosureComponent,
    DisclosureTriggerForDirective,
    FormControlModule,
    I18nPipe,
    IconComponent,
    ItemModule,
    LinkModule,
    SectionComponent,
    SectionHeaderComponent,
    SkeletonComponent,
    SkeletonGroupComponent,
    SkeletonTextComponent,
    StopClickDirective,
    SvgComponent,
    TypographyModule,
  ],
})
export class AgentAccessConnectComponent implements OnInit {
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly pageState = inject(AgentAccessPageStateService);

  protected readonly AGENT_LOGOS = AGENT_LOGOS;
  protected readonly McpRegistrationStrategyKind = McpRegistrationStrategyKind;

  /** Placeholder cards shown by the grid skeleton while detection/status/CLI-path load — one per
   *  supported agent, so the loading grid has the same shape as the real one. */
  protected readonly skeletonPlaceholders = SUPPORTED_AGENTS.map((_, index) => index);

  protected readonly loading = signal(true);
  protected readonly aacPath = signal<string | null>(null);
  protected readonly detectionResults = signal<AgentDetectionResult[]>([]);

  /** Bound to the "My agent isn't listed" disclosure — collapsed by default. */
  protected readonly mcpConfigOpen = signal(false);

  /** This session's `registerWithAgent` outcome per agent, keyed by `AgentId` — rendered on each
   *  agent's own card. Deliberately *not* cleared between attempts, so an agent's last outcome
   *  stays visible until it's registered again. Only ever populated for a `FileMerge` action or a
   *  `Deeplink`'s fallback action — see `AgentCardAction`. */
  protected readonly connectResults = signal<Partial<Record<AgentId, RegisterWithAgentResult>>>({});

  /** `SUPPORTED_AGENTS`, each paired with its detection/registration outcomes, its one card
   *  action, and the most recent `registerWithAgent` result (if any), sorted so agents detected on
   *  this machine appear first. `Array#sort` is spec-guaranteed stable, so agents within each
   *  group (detected / not detected) keep the registry's original order. */
  protected readonly selectableAgents = computed<SelectableAgent[]>(() => {
    const aacPath = this.aacPath();
    const detectedIds = new Set(
      this.detectionResults()
        .filter((result) => result.detected)
        .map((result) => result.agentId),
    );
    const statusByAgent = new Map(
      this.pageState
        .registrationStatuses()
        .map((result) => [result.agentId, result.status] as const),
    );
    const connectResults = this.connectResults();

    return [...SUPPORTED_AGENTS]
      .map((definition): SelectableAgent => {
        const connectResult = connectResults[definition.id];
        const detected = detectedIds.has(definition.id);
        // `notRegistered` and `unknown` both fall through to `false` here — an inconclusive
        // status query must never render as a false-negative "not connected".
        const connected = statusByAgent.get(definition.id) === AgentRegistrationStatus.Registered;
        return {
          definition,
          detected,
          connected,
          // "Connected" takes priority — it implies "Detected", so showing both badges on the
          // same card is redundant, and stacking them misaligns the card against its siblings.
          badge: connected
            ? { messageKey: "agentAccessConnectConnectedBadge", variant: "primary" }
            : detected
              ? { messageKey: "agentAccessConnectDetected", variant: "success" }
              : null,
          action: buildAgentCardAction(definition, aacPath),
          connectResultMessageKey: connectResult
            ? REGISTER_RESULT_MESSAGE_KEYS[connectResult.status]
            : null,
          connectResultIsError: connectResult?.status === RegisterWithAgentStatus.Error,
        };
      })
      .sort((a, b) => Number(b.detected) - Number(a.detected));
  });

  /** Pretty-printed MCP config for the "Copy config" escape hatch. `null` until the bundled CLI
   *  path has resolved, or forever if it never does (binary missing — see
   *  `agentAccessConnectAacNotFound*` in the template). */
  protected readonly mcpConfigJson = computed(() => {
    const aacPath = this.aacPath();
    return aacPath == null ? null : JSON.stringify(buildBitwardenMcpConfig(aacPath), null, 2);
  });

  async ngOnInit() {
    this.loading.set(true);
    try {
      const [aacPath, detectionResults] = await Promise.all([
        ipc.agentAccess.getBundledCliPath(),
        ipc.agentAccess.detectAgents(),
        this.pageState.refreshRegistrationStatuses(),
      ]);
      this.aacPath.set(aacPath);
      this.detectionResults.set(detectionResults);
    } finally {
      this.loading.set(false);
    }
  }

  protected openSetupDocs() {
    this.platformUtilsService.launchUri(AGENT_ACCESS_SETUP_URL);
  }

  /** Bound to a `Deeplink` agent's primary button (Cursor, and Copilot's primary action). `uri` is
   *  `null` only while `aacPath()` hasn't resolved yet — the button disables in that case, but
   *  guard here too since a disabled `bitButton` can still be reached via keyboard in some states. */
  protected launchDeeplink(uri: string | null): void {
    if (uri == null) {
      return;
    }
    this.platformUtilsService.launchUri(uri);
  }

  /** Bound via `[bitAction]` to a `FileMerge` agent's "Connect" button, and to a `Deeplink`
   *  agent's declared-fallback secondary action ("VS Code didn't open? Write the config file
   *  directly") — both resolve to the same IPC call, which decides *what* to write; the caller
   *  (this component) only ever decides *when*, and only in response to an explicit click on
   *  either of those two buttons, never automatically. `bitAction` owns that button's own
   *  loading/disabled state, so there's no shared "connecting" flag across cards — each card's
   *  action is independent, and its result is reported on that same card. */
  protected registerWithAgentAction(agentId: AgentId): () => Promise<void> {
    return () => this.registerWithAgent(agentId);
  }

  private async registerWithAgent(agentId: AgentId): Promise<void> {
    let result: RegisterWithAgentResult;
    try {
      result = await ipc.agentAccess.registerWithAgent(agentId);
    } catch {
      result = { status: RegisterWithAgentStatus.Error };
    }
    this.connectResults.update((results) => ({ ...results, [agentId]: result }));
    await this.pageState.refreshRegistrationStatuses();
  }

  /** Bound to the "Refresh" affordance, and re-run automatically on window focus (see the class
   *  doc). Re-fetches the persistent per-agent registration status — via the shared
   *  `AgentAccessPageStateService`, so a newly-registered agent's "Connected" badge here and the
   *  setup checklist's "Connect an AI assistant" task both reflect reality — the only way this
   *  page can close the loop for `ManualCommand`/`Deeplink` actions, which complete entirely
   *  outside this app's process. A direct alias to the service's own stable arrow field, so it can
   *  still be bound directly via `[bitAction]` (which owns its button's own loading state) without
   *  losing `this`. */
  protected readonly refreshRegistrationStatuses = this.pageState.refreshRegistrationStatuses;

  protected onWindowFocus(): void {
    void this.refreshRegistrationStatuses();
  }
}
