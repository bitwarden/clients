import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from "@angular/core";

/**
 * Destroys and re-creates the view whenever the bound key changes, so a component that would
 * otherwise be reused starts over with fresh state.
 */
@Directive({ selector: "[vaultRemountOn]" })
export class VaultRemountOnDirective {
  private readonly templateRef = inject(TemplateRef);
  private readonly viewContainer = inject(ViewContainerRef);

  /** The identity of the state the view holds. */
  readonly vaultRemountOn = input.required<unknown>();

  constructor() {
    effect(() => {
      this.vaultRemountOn();
      this.viewContainer.clear();
      this.viewContainer.createEmbeddedView(this.templateRef);
    });
  }
}
