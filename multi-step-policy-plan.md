🎯 Multi-step Policy Edit Dialog Component
Implementation Plan for consolidating multi-step policy dialog workflows

📋 Overview
Goal: Create a reusable MultiStepPolicyEditDialogComponent that consolidates multi-step policy dialog logic.

Approach: Policy components (extending BasePolicyEditComponent) define their multi-step workflow and template structure. The dialog component reads this configuration from the policy component instance and is the consumer of the multi step policy configuration. This creates a clean separation of concerns between the policy and the dialog.

Longer term: This should wholesale replace the existing PolicyEditDialogComponent in favor of this configuration driven multi-step dialog component as it should easily be able to support single step work flows (It will probably just be tedious tech-debt work to update the existing policy components)

📁 Files to Create/Modify
Action

File

Description

✏️ Modify

models.ts

Rename MultiStepSubmit to PolicyStep

Add optional disableSave

Add bodyContent template signal

✏️ Modify

base-policy-edit.component.ts

Add optional policySteps property & remove confirm()

➕ Create

multi-step-policy-edit-dialog.component.ts

New reusable multi-step dialog component

➕ Create

multi-step-policy-edit-dialog.component.html

Template for multi-step dialog

✏️ Modify

index.ts

Export new component

🔧 Implementation Details
1️⃣ Modify: models.ts
Path: apps/web/src/app/admin-console/organizations/policies/policy-edit-dialogs/models.ts

Changes:

Rename MultiStepSubmit to PolicyStep

Add optional disableSave property to PolicyStep type

Add bodyContent template signal

export type PolicyStep = {
sideEffect?: () => Promise<void>;
titleContent: Signal<TemplateRef<unknown>>;
bodyContent: Signal<TemplateRef<unknown>>; // NEW: include body template
footerContent: Signal<TemplateRef<unknown>>;
disableSave?: Observable<boolean>; // NEW: Optional - coallesces to of(false)
}
2️⃣ Modify: base-policy-edit.component.ts
Path: apps/web/src/app/admin-console/organizations/policies/base-policy-edit.component.ts

Changes:

➕ Add policySteps property

➕ Add currentStep input to receive signal from parent dialog

❌ Remove confirm() method (old approach)

@Directive()
export abstract class BasePolicyEditComponent implements OnInit {
@Input() policyResponse: PolicyResponse | undefined;
@Input() policy: BasePolicyEditDefinition | undefined;
@Input() currentStep: Signal<number> = signal(0); // NEW: Input signal from parent dialog
enabled = new FormControl(false);
data: UntypedFormGroup | undefined;
policySteps?: PolicyStep[]; // NEW: Optional multi-step configuration
// ... existing methods
}
Note: The confirm() method should be removed entirely from the base class.

3️⃣ Create: multi-step-policy-edit-dialog.component.ts
Path: apps/web/src/app/admin-console/organizations/policies/policy-edit-dialogs/multi-step-policy-edit-dialog.component.ts

Component Structure:

Extends PolicyEditDialogComponent

Uses existing PolicyEditDialogData type

Class members:

policySteps: PolicyStep[]

saveDisable$: Observable<boolean>

currentStep: WritableSignal<number>

policyComponentRef: ComponentRef<BasePolicyEditComponent> | undefined

ngAfterViewInit() Override

async ngAfterViewInit() {
await super.ngAfterViewInit();
// Create the component and store the ref
this.policyComponentRef = this.policyFormRef.createComponent(this.data.policy.component);
this.policyComponent = this.policyComponentRef.instance;
// Set inputs using ComponentRef.setInput()
this.policyComponentRef.setInput('policyResponse', policyResponse);
this.policyComponentRef.setInput('policy', this.data.policy);
this.policyComponentRef.setInput('currentStep', this.currentStep); // Pass the signal itself
// Read the steps configuration from the child component
this.policySteps = this.policyComponent.policySteps ?? [];
this.saveDisabled$ = this.policySteps[this.currentStep()]?.disableSave ?? of(false);
}
submit() Method
⚠️ Important: Does NOT call confirm() - that method is being removed

submit = async () => {
if (!this.policyComponent) {
throw new Error("PolicyComponent not initialized.");
}
try {
// Execute side effect for current step
const sideEffect = this.policySteps[this.currentStep()].sideEffect;
if (sideEffect) {
await sideEffect();
}
// If last step, show success and close
if (this.currentStep() === this.policySteps.length - 1) {
this.toastService.showToast({
variant: "success",
message: this.i18nService.t("editedPolicyId", this.i18nService.t(this.data.policy.name))
});
this.dialogRef.close("saved");
return;
}
// Otherwise, move to next step
this.currentStep.update((value) => value + 1);
this.policyComponent.setStep(this.currentStep());
this.saveDisabled$ = this.policySteps[this.currentStep()]?.disableSave ?? of(false);
} catch (error: any) {
this.toastService.showToast({
variant: "error",
message: error.message
});
}
};
Static open() Method
Provides DialogService integration (standard pattern).

4️⃣ Create: multi-step-policy-edit-dialog.component.html
Path: apps/web/src/app/admin-console/organizations/policies/policy-edit-dialogs/multi-step-policy-edit-dialog.component.html

Key Features:

Dynamic title, body, and footer content from templates

Loading state handling

<form [formGroup]="formGroup" [bitSubmit]="submit">
  <bit-dialog [loading]="loading">
    <ng-container bitDialogTitle>
      @let title = policySteps[currentStep()]?.titleContent();
      @if (title) {
        <ng-container [ngTemplateOutlet]="title"></ng-container>
      }
    </ng-container>
    <ng-container bitDialogContent>
      @if (loading) {
        <div>
          <i class="bwi bwi-spinner bwi-spin tw-text-muted" title="{{ 'loading' | i18n }}" aria-hidden="true"></i>
          <span class="tw-sr-only">{{ "loading" | i18n }}</span>
        </div>
      } @else {
        @if (policy.showDescription) {
          <p bitTypography="body1">{{ policy.description | i18n }}</p>
        }
        @let body = policySteps[currentStep()]?.bodyContent();
        @if (body) {
          <ng-container [ngTemplateOutlet]="body"></ng-container>
        }
      }
    </ng-container>
    <ng-container bitDialogFooter>
      @let footer = policySteps[currentStep()]?.footerContent();
      @if (footer) {
        <ng-container [ngTemplateOutlet]="footer"></ng-container>
      }
    </ng-container>
  </bit-dialog>
</form>
5️⃣ Update: index.ts
Path: apps/web/src/app/admin-console/organizations/policies/policy-edit-dialogs/index.ts

Changes: Export the new component

export \* from "./multi-step-policy-edit-dialog.component";
💡 Usage Patterns
Policy Component Pattern
Policy components define their multi-step configuration:

export class MyPolicyEditComponent extends BasePolicyEditComponent implements OnInit {
private readonly step0Title: Signal<TemplateRef<unknown>> = viewChild.required("step0Title");
private readonly step0Body: Signal<TemplateRef<unknown>> = viewChild.required("step0Body");
private readonly step0Footer: Signal<TemplateRef<unknown>> = viewChild.required("step0Footer");
protected policySteps: PolicyStep[] = [
{
sideEffect: async () => await this.handleSubmit(),
footerContent: this.step0Footer,
bodyContent: this.step0Body,
titleContent: this.step0Title,
disableSave: this.saveDisabled$ // some arbitrary logic for your policy
}
];
}
Example Templates

<ng-template #step0Title>
{{ policy.name | i18n }}
</ng-template>
<ng-template #step0Content>
<bit-form-control>
<input type="checkbox" id="enabled" bitCheckbox [formControl]="enabled" />
<bit-label>{{ "turnOn" | i18n }}</bit-label>
</bit-form-control>
</ng-template>
<ng-template #step0Footer>
<button
bitButton
buttonType="primary"
bitFormButton
type="submit"

>

    {{ "save" | i18n }}

  </button>
  <button bitButton buttonType="secondary" bitDialogClose type="button">
    {{ "cancel" | i18n }}
  </button>
</ng-template>
Policy Definition
Specify to use the multi-step dialog:

export class MyPolicy extends BasePolicyEditDefinition {
name = "myPolicy";
type = PolicyType.MyPolicy;
component = MyPolicyEditComponent;
editDialogComponent = MultiStepPolicyEditDialogComponent;
}
✅ Benefits
Benefit

Description

📦 Component Encapsulation

Steps defined where templates and logic exist

🔗 Context Access

Side effects, observables, and templates all in one place

🧹 Cleaner Flow

No outdated confirm() method or direct child manipulation

♻️ Reusability

Generic component works with any policy that defines steps

🎨 Template Flexibility

Full Angular template power for custom buttons/titles

🔧 Per-Step Control

Each step can have its own save button disable logic

📝 Summary
This implementation consolidates multi-step policy dialog logic into a single reusable component, reducing code duplication while providing maximum flexibility for policy-specific workflows. Policy components maintain full control over their step presentation and behavior through template-based configuration.

hourglass done Future work
Better support for single step workflows

Refactor existing policy edit definitions to specify the multi-step dialog as their editDialogComponent.

Refactor existing policy edit components to provide their header, body, footer content, submit side-effects, and optionally observable with logic to disable saving

Once all policies are using the new flow, remove the old components and remove the ability to specify edit dialog components in policy definitions.
