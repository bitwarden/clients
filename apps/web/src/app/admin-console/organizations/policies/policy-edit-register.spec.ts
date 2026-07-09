import { MultiStepPolicyEditDialogComponent } from "./policy-edit-dialogs/multi-step-policy-edit-dialog.component";
import { ossPolicyEditRegister } from "./policy-edit-register";

/**
 * Custom `editDialogComponent`s that have been audited and have dedicated regression tests
 * proving their v2-only UI does not leak into the v1/modal experience when the `PolicyDrawers`
 * feature flag is off (see multi-step-policy-edit-dialog.component.spec.ts).
 *
 * Policies WITHOUT a custom `editDialogComponent` are structurally safe from this class of bug:
 * `PolicyEditDialogComponent` (v1/modal) and `PolicyEditDrawerComponent` (v2/drawer) are two
 * entirely separate component classes with no shared branching logic, so a v2-only design change
 * cannot leak into the v1 modal.
 *
 * If you introduce a new custom `editDialogComponent` that renders differently based on
 * `dialogRef.isDrawer` (or similar), add regression tests proving it doesn't leak v2 UI into v1,
 * then add it here. Until you do, this test will fail as a reminder.
 */
const AUDITED_CUSTOM_DIALOG_COMPONENTS: unknown[] = [MultiStepPolicyEditDialogComponent];

/**
 * This is a generic, register-driven regression guard (requested in PR review) against v2-only
 * UI leaking into the v1/modal experience when the `PolicyDrawers` feature flag is off. It runs
 * against every policy currently registered, so it automatically covers new policies too -
 * nobody has to remember to add this check by hand.
 */
describe("ossPolicyEditRegister - v1/v2 leak regression guard", () => {
  it("is not empty (sanity check)", () => {
    expect(ossPolicyEditRegister.length).toBeGreaterThan(0);
  });

  it.each(ossPolicyEditRegister.map((policy) => [PolicyTypeName(policy), policy] as const))(
    "%s: v2 component (if any) differs from v1, and any custom editDialogComponent is audited",
    (_name, policy) => {
      if (!policy.v2) {
        return;
      }

      expect(policy.v2.component).not.toBe(policy.component);

      if (policy.editDialogComponent) {
        expect(AUDITED_CUSTOM_DIALOG_COMPONENTS).toContain(policy.editDialogComponent);
      }
    },
  );
});

function PolicyTypeName(policy: { name: string; type: number }): string {
  return `${policy.name} (type ${policy.type})`;
}
