import { Injectable } from "@angular/core";
import { FormGroupDirective } from "@angular/forms";

/**
 * Tracks registered FormGroupDirectives to determine if any form has unsaved changes.
 * Forms are registered/deregistered automatically by BitSubmitDirective.
 *
 * We track FormGroupDirective (not FormGroup) because components may reassign
 * their FormGroup instance (e.g., cipher-form reinitializes on config change).
 * The directive always reflects the currently bound FormGroup.
 */
@Injectable({ providedIn: "root" })
export class DirtyFormService {
  private registeredDirectives = new Set<FormGroupDirective>();

  registerForm(directive: FormGroupDirective): void {
    this.registeredDirectives.add(directive);
  }

  deregisterForm(directive: FormGroupDirective): void {
    this.registeredDirectives.delete(directive);
  }

  hasDirtyForm(): boolean {
    for (const directive of this.registeredDirectives) {
      if (directive.form?.dirty) {
        return true;
      }
    }
    return false;
  }
}
