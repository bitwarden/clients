import { FocusKeyManager } from "@angular/cdk/a11y";
import {
  Component,
  Output,
  TemplateRef,
  ViewChild,
  EventEmitter,
  ContentChildren,
  QueryList,
  AfterContentInit,
  Input,
  OnInit,
  OnDestroy,
} from "@angular/core";
import { filter, map, Subject, takeUntil } from "rxjs";

import { AsyncContextService } from "../async-actions/async-context.service";

import { MenuItemComponent } from "./menu-item.component";

@Component({
  selector: "bit-menu",
  templateUrl: "./menu.component.html",
  exportAs: "menuComponent",
  providers: [AsyncContextService],
})
export class MenuComponent implements AfterContentInit, OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @ViewChild(TemplateRef) templateRef: TemplateRef<any>;
  @Output() closed = new EventEmitter<void>();
  @ContentChildren(MenuItemComponent, { descendants: true })
  menuItems: QueryList<MenuItemComponent>;
  keyManager?: FocusKeyManager<MenuItemComponent>;

  @Input() ariaRole: "menu" | "dialog" = "menu";

  @Input() ariaLabel: string;

  constructor(private asyncContextService: AsyncContextService) {}

  ngOnInit(): void {
    this.asyncContextService.completedAction$
      .pipe(
        filter(({ definedIn }) => definedIn === this.asyncContextService),
        map(() => undefined),
        takeUntil(this.destroy$)
      )
      .subscribe(this.closed);
  }

  ngAfterContentInit() {
    if (this.ariaRole === "menu") {
      this.keyManager = new FocusKeyManager(this.menuItems).withWrap();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
