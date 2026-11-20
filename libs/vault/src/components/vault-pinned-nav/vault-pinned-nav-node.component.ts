import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { isActive, Router } from "@angular/router";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CollectionId } from "@bitwarden/common/types/guid";
import {
  HoverRevealContainerDirective,
  HoverRevealDirective,
  NavigationModule,
} from "@bitwarden/components";

import { EXACT_PATH } from "../../routing/exact-path";
import { CollectionOptionsMenuComponent } from "../collection-options-menu";

import { PinnedFolderNode } from "./pinned-shared-folder-nodes";

/**
 * One pinned shared folder in the side nav: a group with a chevron when folders are nested beneath
 * it, a plain item otherwise.
 *
 * A component of its own, rather than a recursive template, so every level is created inside the
 * group above it. The nav items find their parent group, and so their indent, through injection,
 * and a template resolves that from where it is declared rather than from where it is rendered.
 */
@Component({
  selector: "vault-pinned-nav-node",
  templateUrl: "./vault-pinned-nav-node.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    NavigationModule,
    CollectionOptionsMenuComponent,
    HoverRevealContainerDirective,
    HoverRevealDirective,
  ],
})
export class VaultPinnedNavNodeComponent {
  readonly node = input.required<PinnedFolderNode>();

  /** Whether the user pinned this folder itself, rather than it showing only beneath a pinned ancestor. */
  readonly pinned = input(false);

  /** `undefined` while the organization list is still loading. */
  readonly organization = input<Organization | undefined>(undefined);

  /**
   * Route commands for every folder in the tree, by id. Handed down rather than built per node so
   * `routerLink` gets the same array on every change detection pass.
   */
  readonly routes = input.required<ReadonlyMap<CollectionId, string[]>>();

  private readonly router = inject(Router);

  protected readonly route = computed(() => this.routes().get(this.node().id));

  /**
   * Whether this folder's own page is in view. An open group hides the active styles of its row, so
   * the group is told to keep them while its folder is the page in view.
   */
  protected readonly active = computed(() => {
    const route = this.route();
    return route != null && isActive(this.router.createUrlTree(route), this.router, EXACT_PATH)();
  });
}
