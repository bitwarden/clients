import { CommonModule } from "@angular/common";
import {
  booleanAttribute,
  Component,
  EventEmitter,
  Output,
  input,
  model,
  signal,
  OnInit,
  OnDestroy,
  ContentChildren,
  QueryList,
  AfterContentChecked,
} from "@angular/core";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { MenuModule, MenuTriggerForDirective } from "../menu";
import { media } from "../utils/media-query";

import { ToggleComponent } from "./toggle.component";

let nextId = 0;

@Component({
  selector: "bit-toggle-group",
  templateUrl: "./toggle-group.component.html",
  imports: [CommonModule, MenuModule, MenuTriggerForDirective],
})
export class ToggleGroupComponent<TValue = unknown>
  implements OnInit, AfterContentChecked, OnDestroy
{
  private id = nextId++;
  name = `bit-toggle-group-${this.id}`;

  @ContentChildren(ToggleComponent) toggles!: QueryList<ToggleComponent<TValue>>;

  readonly fullWidth = input<boolean, unknown>(undefined, { transform: booleanAttribute });

  readonly selected = model<TValue>();
  selectedLabel = signal<string | null>(null);

  readonly smallScreenQuery = input<string>("(max-width: 480px)");
  @Output() selectedChange = new EventEmitter<TValue>();

  private isSmallScreen$: ReturnType<typeof media>;
  protected isSmallScreen = signal(false);
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.isSmallScreen$ = media(this.smallScreenQuery());
    this.isSmallScreen$.pipe(takeUntil(this.destroy$)).subscribe((isSmall) => {
      this.isSmallScreen.set(isSmall);
    });
  }

  ngAfterContentChecked() {
    if (this.selectedLabel() === null) {
      const value = this.selected();
      const selectedToggle =
        value !== undefined ? this.toggles.find((t) => t.value() === value) : this.toggles.first;
      if (selectedToggle) {
        this.selectedLabel.set(selectedToggle.labelTitle());
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onInputInteraction(toggle: ToggleComponent<TValue>) {
    const value = toggle.value();
    const label = toggle.labelTitle();
    this.selectedLabel.set(label);
    this.selected.set(value);
    this.selectedChange.emit(value);
  }
}
