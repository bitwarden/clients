import { Directive, OnDestroy, OnInit } from "@angular/core";
import { Subject, takeUntil } from "rxjs";

import { ButtonLikeAbstraction } from "../shared/button-like.abstraction";

import { AsyncContextService } from "./async-context.service";

// TODO: Add MDX docs for this directive
@Directive({
  selector: "[bitAsyncDisable]",
})
export class BitAsyncDisableDirective implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    private asyncContext: AsyncContextService,
    private buttonComponent: ButtonLikeAbstraction
  ) {}

  ngOnInit(): void {
    this.asyncContext.loading$.pipe(takeUntil(this.destroy$)).subscribe((loading) => {
      this.buttonComponent.disabled = loading;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
