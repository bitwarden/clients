import { Directive, TemplateRef, inject } from "@angular/core";

/**
 * Structural directive that captures a column's header template. Used inside
 * `<bit-column>`; the column reads `template` to render the header.
 *
 * No inputs — the column key lives on the sibling `*bitColumnFor`. This
 * directive's only job is to mark the header markup for relocation into the
 * table's `<thead>`.
 */
@Directive({
  selector: "[bitColumnHeader]",
})
export class BitColumnHeaderDirective {
  readonly template = inject(TemplateRef);
}
