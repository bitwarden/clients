import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  output,
  signal,
} from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  ButtonModule,
  CalloutModule,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
} from "@bitwarden/components";

import { LeasingPolicy } from "@bitwarden/pam";

import { HumanApprovalEditorComponent } from "../human-approval/human-approval-editor.component";
import { StubIpAllowlistEditorComponent } from "../_stub-ip-allowlist/stub-ip-allowlist-editor.component";
import { StubTimeOfDayEditorComponent } from "../_stub-time-of-day/stub-time-of-day-editor.component";

/** The child-policy kinds the composite editor supports. */
export const ChildPolicyKind = Object.freeze({
  HumanApproval: "human_approval",
  IpAllowlist: "ip_allowlist",
  TimeOfDay: "time_of_day",
} as const);
export type ChildPolicyKind = (typeof ChildPolicyKind)[keyof typeof ChildPolicyKind];

/** All kinds available as children inside a composite, in display order. */
export const ALL_CHILD_KINDS: ChildPolicyKind[] = [
  ChildPolicyKind.HumanApproval,
  ChildPolicyKind.IpAllowlist,
  ChildPolicyKind.TimeOfDay,
];

/** One slot in the composite child list. */
export interface ChildSlot {
  readonly id: number;
  kind: ChildPolicyKind;
  policy: LeasingPolicy | null;
  /** Inline i18n key for the slot error message, or null when there is no error. */
  error: string | null;
}

/**
 * Composite (all_of) policy editor.
 *
 * Renders a stacked list of child-policy cards. Each card has its own mode
 * selector and the corresponding editor. Validation enforces:
 *  - At least two children.
 *  - No duplicate kinds (e.g. two ip_allowlist children).
 *  - No nested composites (all_of is excluded from the available kind list).
 *
 * Serializes to `{ kind: "all_of", children: [...] }`.
 *
 * User-facing description: "All conditions must be met. If any condition needs
 * a human, the request goes to a human."
 */
@Component({
  selector: "pam-composite-policy-editor",
  templateUrl: "./composite-policy-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    JslibModule,
    ButtonModule,
    CalloutModule,
    FormFieldModule,
    IconButtonModule,
    LinkModule,
    HumanApprovalEditorComponent,
    StubIpAllowlistEditorComponent,
    StubTimeOfDayEditorComponent,
  ],
})
export class CompositePolicyEditorComponent implements OnInit {
  /** Emitted whenever the serialized policy changes (null when the form is invalid). */
  readonly policyChange = output<LeasingPolicy | null>();

  /** Emitted when a child human-approval editor requests access-tab navigation. */
  readonly manageMembersClicked = output<void>();

  protected readonly slots = signal<ChildSlot[]>([]);

  /** True when the composite is in a valid, saveable state. */
  protected readonly isValid = computed(() => {
    const s = this.slots();
    return (
      s.length >= 2 && s.every((slot) => slot.error === null && slot.policy !== null)
    );
  });

  /** The set of kinds already chosen — used to exclude duplicates from the selectors. */
  protected readonly usedKinds = computed(() => new Set(this.slots().map((s) => s.kind)));

  protected readonly ChildPolicyKind = ChildPolicyKind;
  protected readonly ALL_CHILD_KINDS = ALL_CHILD_KINDS;

  private nextId = 0;

  ngOnInit(): void {
    this.addSlot();
    this.addSlot();
    this.emitPolicy();
  }

  protected addSlot(): void {
    const used = this.usedKinds();
    const nextKind = ALL_CHILD_KINDS.find((k) => !used.has(k));
    if (nextKind === undefined) {
      return;
    }
    const slot: ChildSlot = {
      id: this.nextId++,
      kind: nextKind,
      policy: nextKind === ChildPolicyKind.HumanApproval ? { kind: "human_approval" } : null,
      error: null,
    };
    this.slots.update((prev) => [...prev, slot]);
    this.validate();
    this.emitPolicy();
  }

  protected removeSlot(id: number): void {
    this.slots.update((prev) => prev.filter((s) => s.id !== id));
    this.validate();
    this.emitPolicy();
  }

  protected onKindChange(id: number, newKind: ChildPolicyKind): void {
    this.slots.update((prev) =>
      prev.map((s) => {
        if (s.id !== id) {
          return s;
        }
        return {
          ...s,
          kind: newKind,
          policy: newKind === ChildPolicyKind.HumanApproval ? { kind: "human_approval" } : null,
          error: null,
        };
      }),
    );
    this.validate();
    this.emitPolicy();
  }

  protected onChildPolicyChange(id: number, policy: LeasingPolicy): void {
    this.slots.update((prev) => prev.map((s) => (s.id === id ? { ...s, policy } : s)));
    this.emitPolicy();
  }

  protected onManageMembersClicked(): void {
    this.manageMembersClicked.emit();
  }

  /** Returns the kinds available for a slot (excludes already-used kinds except the slot's own). */
  protected availableKinds(slot: ChildSlot): ChildPolicyKind[] {
    const used = this.usedKinds();
    return ALL_CHILD_KINDS.filter((k) => !used.has(k) || k === slot.kind);
  }

  /** True when there are unused kinds left to add. */
  protected get canAddMore(): boolean {
    return this.slots().length < ALL_CHILD_KINDS.length;
  }

  /** Returns the i18n key for a given child kind's display label. */
  protected kindLabelKey(kind: ChildPolicyKind): string {
    return "pamLeasingMode_" + kind;
  }

  private validate(): void {
    const slots = this.slots();
    const kindCounts = new Map<ChildPolicyKind, number>();
    for (const slot of slots) {
      kindCounts.set(slot.kind, (kindCounts.get(slot.kind) ?? 0) + 1);
    }

    this.slots.update((prev) =>
      prev.map((slot) => {
        const count = kindCounts.get(slot.kind) ?? 0;
        const error: string | null = count > 1 ? "policyCompositeDuplicateKindError" : null;
        return { ...slot, error };
      }),
    );
  }

  private emitPolicy(): void {
    if (!this.isValid()) {
      this.policyChange.emit(null);
      return;
    }
    const children = this.slots()
      .map((s) => s.policy)
      .filter((p): p is LeasingPolicy => p !== null);
    this.policyChange.emit({ kind: "all_of", children });
  }
}
