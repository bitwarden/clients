import { Directive } from "@angular/core";

/**
 * Marks the element a composing wrapper (e.g. `bit-file-dropzone`) projects into `bit-form-field`
 * as its own control layout. Its presence switches the field from the default container chrome to
 * the `[bitCustomInput]` slot.
 */
@Directive({ selector: "[bitCustomInput]" })
export class BitCustomInputDirective {}
