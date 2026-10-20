import { Component, ChangeDetectionStrategy, input, signal, output } from "@angular/core";

import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  SectionHeaderComponent,
  SectionComponent,
  ItemModule,
  ButtonModule,
  IconButtonModule,
  TypographyModule,
  IconModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "health-excluded-items-list",
  templateUrl: "./health-excluded-items-list.component.html",
  imports: [
    SectionHeaderComponent,
    SectionComponent,
    I18nPipe,
    ItemModule,
    AppVaultIconComponent,
    TypographyModule,
    ButtonModule,
    IconModule,
    IconButtonModule,
  ],
})
export class HealthExcludedItemsListComponent {
  // List of health excluded items to be displayed in the component
  readonly items = input.required<CipherView[]>();

  // Emits when the user clicks restore button for an excluded item, emitting the cipher ID of the item to be restored
  readonly onRestoreItem = output<string>();

  readonly isCollapsed = signal(true);

  readonly onCollapseClick = () => this.isCollapsed.update((value) => !value);
}
