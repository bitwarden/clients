import {
  AfterContentInit,
  Component,
  ContentChildren,
  EventEmitter,
  Input,
  Optional,
  Output,
  QueryList,
  SkipSelf,
} from "@angular/core";

import { NavBaseComponent } from "./nav-base.component";

@Component({
  selector: "bit-nav-group",
  templateUrl: "./nav-group.component.html",
  providers: [{ provide: NavBaseComponent, useExisting: NavGroupComponent }],
})
export class NavGroupComponent extends NavBaseComponent implements AfterContentInit {
  @ContentChildren(NavBaseComponent, {
    descendants: true,
  })
  nestedNavComponents!: QueryList<NavBaseComponent>;

  /** The parent nav item should not show active styles when open. */
  protected get parentHideActiveStyles(): boolean {
    return this.hideActiveStyles || this.open;
  }

  /**
   * UID for `[attr.aria-controls]`
   */
  protected contentId = Math.random().toString(36).substring(2);

  /**
   * Is `true` if the expanded content is visible
   */
  @Input()
  open = false;

  @Output()
  openChange = new EventEmitter<boolean>();

  constructor(@Optional() @SkipSelf() private parentNavGroup: NavGroupComponent) {
    super();
  }

  setOpen(isOpen: boolean) {
    this.open = isOpen;
    this.openChange.emit(this.open);
    this.open && this.parentNavGroup?.setOpen(this.open);
  }

  protected toggle(event?: MouseEvent) {
    event?.stopPropagation();
    this.setOpen(!this.open);
  }

  /**
   * - For any nested NavGroupComponents or NavItemComponents, increment the `treeDepth` by 1.
   */
  private initNestedStyles() {
    if (this.variant !== "tree") {
      return;
    }
    [...this.nestedNavComponents].forEach((navGroupOrItem) => {
      navGroupOrItem.treeDepth += 1;
    });
  }

  ngAfterContentInit(): void {
    this.initNestedStyles();
  }
}
