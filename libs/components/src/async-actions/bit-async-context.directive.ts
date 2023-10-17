import { Directive } from "@angular/core";

import { AsyncContextService } from "./async-context.service";

@Directive({
  selector: "[bitAsyncContext]",
  providers: [AsyncContextService],
})
export class BitAsyncContextDirective {}
