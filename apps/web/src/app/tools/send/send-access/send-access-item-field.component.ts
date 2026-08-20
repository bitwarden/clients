import { ChangeDetectionStrategy, Component, input, OnInit, signal } from "@angular/core";

import { SharedModule } from "../../../shared";

@Component({
  selector: "app-send-access-item-field",
  templateUrl: "send-access-item-field.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendAccessItemFieldComponent implements OnInit {
  /** The value of the field */
  readonly value = input.required<string>();
  /** The translation key of the label for the field */
  readonly label = input.required<string>();
  /** Whether or not the field can be copied */
  readonly copyable = input<boolean>(true);
  /** The translation key of the label for the copy button */
  readonly copyButtonLabel = input<string>();
  /** Whether the field is hidden by default and must be unhidden */
  readonly hideable = input<boolean>(false);

  readonly hidden = signal(true);

  ngOnInit() {
    this.hidden.set(this.hideable());
  }

  toggleHidden(newValue: boolean) {
    this.hidden.set(newValue);
  }
}
