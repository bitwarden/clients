import { AsyncContextService } from "./async-context.service";
import { BitAsyncTag } from "./bit-async-tag";

/**
 * This class describes an async event that is awaiting execution.
 */
export class BitAsyncEvent<E = unknown> {
  constructor(
    readonly originalContext: AsyncContextService,
    readonly tag?: BitAsyncTag,
    readonly originalEvent?: E
  ) {}
}
