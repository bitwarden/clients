import { Directive, Input, TemplateRef, ViewContainerRef } from "@angular/core";

// https://stackoverflow.com/a/43172992
/**
 * A directive that allows you to declare a variable inside a template.
 *
 * @example
 * ```html
 * <div *ngVar="false as myVar">
 *  {{ myVar }}
 * </div>
 * ```
 */
@Directive({
  selector: "[ngVar]",
})
export class VarDirective<T = number> {
  @Input()
  set ngVar(context: T) {
    this.context.$implicit = this.context.ngVar = context;

    if (!this.hasView) {
      this.vcRef.createEmbeddedView(this.templateRef, this.context);
      this.hasView = true;
    }
  }

  private context: NgVarContext<T> = {
    $implicit: null,
    ngVar: null,
  };

  private hasView: boolean = false;

  constructor(
    private templateRef: TemplateRef<NgVarContext<T>>,
    private vcRef: ViewContainerRef,
  ) {}
}

type NgVarContext<T> = {
  $implicit: T;
  ngVar: T;
};
