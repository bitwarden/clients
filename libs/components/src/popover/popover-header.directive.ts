import { Directive } from "@angular/core";

/** @internal — used by PopoverComponent for signal contentChild detection only. */
@Directive({ selector: '[slot="header"]', standalone: true })
export class PopoverHeaderDirective {}
