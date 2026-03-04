import { Injectable } from "@angular/core";
import { FormGroup } from "@angular/forms";

/**
 * Tracks registered FormGroups to determine if any form has unsaved changes.
 * Forms are registered/deregistered automatically by BitSubmitDirective.
 */
@Injectable({ providedIn: "root" })
export class DirtyFormService {
  private registeredForms = new Set<FormGroup>();

  registerFormGroup(formGroup: FormGroup): void {
    this.registeredForms.add(formGroup);
  }

  deregisterFormGroup(formGroup: FormGroup): void {
    this.registeredForms.delete(formGroup);
  }

  hasDirtyForm(): boolean {
    for (const form of this.registeredForms) {
      if (form.dirty) {
        return true;
      }
    }
    return false;
  }
}
