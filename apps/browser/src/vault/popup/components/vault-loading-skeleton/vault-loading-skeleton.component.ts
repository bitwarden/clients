import { ChangeDetectionStrategy, Component } from "@angular/core";

import {
  SkeletonComponent,
  SkeletonGroupComponent,
  SkeletonTextComponent,
} from "@bitwarden/components";

@Component({
  selector: "vault-loading-skeleton",
  templateUrl: "./vault-loading-skeleton.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonGroupComponent, SkeletonComponent, SkeletonTextComponent],
})
export class VaultLoadingSkeletonComponent {
  protected readonly numberOfItems: null[] = new Array(15).fill(null);
}
