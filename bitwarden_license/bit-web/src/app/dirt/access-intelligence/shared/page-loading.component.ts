import { animate, style, transition, trigger } from "@angular/animations";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  CardComponent as BitCardComponent,
  SkeletonComponent,
  SkeletonGroupComponent,
  SkeletonTextComponent,
} from "@bitwarden/components";

// Page loading component for quick initial loads
// Uses skeleton animations to match the full page layout including header, tabs, and widget cards
// Includes smooth fade-out transition when loading completes
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "dirt-page-loading",
  imports: [
    JslibModule,
    BitCardComponent,
    SkeletonComponent,
    SkeletonGroupComponent,
    SkeletonTextComponent,
  ],
  animations: [
    trigger("fadeOut", [transition(":leave", [animate("300ms ease-out", style({ opacity: 0 }))])]),
  ],
  template: `
    <div class="tw-sr-only" role="status">{{ "loading" | i18n }}</div>

    <div @fadeOut class="tw-min-h-screen tw-flex tw-flex-col">
      <!-- Header Section -->
      <header>
        <!-- Page Title -->
        <bit-skeleton edgeShape="box" class="tw-h-10 tw-w-48 tw-mb-2"></bit-skeleton>

        <!-- Description -->
        <bit-skeleton edgeShape="box" class="tw-h-5 tw-w-96 tw-mb-2"></bit-skeleton>

        <!-- Info Banner -->
        <div
          class="tw-bg-primary-100 tw-rounded-lg tw-w-full tw-px-8 tw-py-4 tw-my-4 tw-flex tw-items-center tw-gap-4"
        >
          <bit-skeleton edgeShape="box" class="tw-size-5"></bit-skeleton>
          <bit-skeleton edgeShape="box" class="tw-h-4 tw-flex-1 tw-max-w-md"></bit-skeleton>
          <bit-skeleton edgeShape="box" class="tw-h-8 tw-w-32"></bit-skeleton>
        </div>
      </header>

      <!-- Tabs Section -->
      <div class="tw-flex-1 tw-flex tw-flex-col">
        <!-- Tab Headers -->
        <div class="tw-flex tw-gap-6 tw-mb-6">
          <bit-skeleton edgeShape="box" class="tw-h-10 tw-w-24"></bit-skeleton>
          <bit-skeleton edgeShape="box" class="tw-h-10 tw-w-32"></bit-skeleton>
          <bit-skeleton edgeShape="box" class="tw-h-10 tw-w-40"></bit-skeleton>
        </div>

        <!-- Tab Content: Activity Cards Grid -->
        <ul
          class="tw-inline-grid tw-grid-cols-3 tw-gap-6 tw-m-0 tw-p-0 tw-w-full tw-auto-cols-auto tw-list-none"
        >
          <!-- Password Change Metric skeleton -->
          <li class="tw-col-span-1">
            <bit-card class="tw-h-56">
              <div class="tw-flex tw-flex-col">
                <bit-skeleton edgeShape="box" class="tw-h-6 tw-w-48 tw-mb-2"></bit-skeleton>
                <bit-skeleton edgeShape="box" class="tw-h-9 tw-w-full tw-mb-2"></bit-skeleton>
                <bit-skeleton-text [lines]="2" class="tw-w-3/4"></bit-skeleton-text>
              </div>
            </bit-card>
          </li>

          <!-- Activity Card 1: At Risk Members -->
          <li class="tw-col-span-1">
            <bit-card class="tw-h-56">
              <div class="tw-flex tw-flex-col">
                <bit-skeleton edgeShape="box" class="tw-h-6 tw-w-32 tw-mb-4"></bit-skeleton>
                <bit-skeleton edgeShape="box" class="tw-h-9 tw-w-24 tw-mb-4"></bit-skeleton>
                <bit-skeleton-text [lines]="2" class="tw-w-full tw-mb-4"></bit-skeleton-text>
                <bit-skeleton edgeShape="box" class="tw-h-6 tw-w-40"></bit-skeleton>
              </div>
            </bit-card>
          </li>

          <!-- Activity Card 2: Critical Applications -->
          <li class="tw-col-span-1">
            <bit-card class="tw-h-56">
              <div class="tw-flex tw-flex-col">
                <bit-skeleton edgeShape="box" class="tw-h-6 tw-w-36 tw-mb-4"></bit-skeleton>
                <bit-skeleton edgeShape="box" class="tw-h-9 tw-w-32 tw-mb-4"></bit-skeleton>
                <bit-skeleton-text [lines]="2" class="tw-w-full tw-mb-4"></bit-skeleton-text>
                <bit-skeleton edgeShape="box" class="tw-h-6 tw-w-44"></bit-skeleton>
              </div>
            </bit-card>
          </li>

          <!-- Activity Card 3: Applications Needing Review -->
          <li class="tw-col-span-1">
            <bit-card class="tw-h-56">
              <div class="tw-flex tw-flex-col">
                <bit-skeleton edgeShape="box" class="tw-h-6 tw-w-44 tw-mb-4"></bit-skeleton>
                <bit-skeleton-group class="tw-mb-4">
                  <bit-skeleton
                    edgeShape="circle"
                    class="tw-size-5"
                    slot="start"
                  ></bit-skeleton>
                  <bit-skeleton edgeShape="box" class="tw-h-9 tw-w-28"></bit-skeleton>
                </bit-skeleton-group>
                <bit-skeleton-text [lines]="2" class="tw-w-full tw-mb-4"></bit-skeleton-text>
                <bit-skeleton edgeShape="box" class="tw-h-8 tw-w-28"></bit-skeleton>
              </div>
            </bit-card>
          </li>
        </ul>
      </div>
    </div>
  `,
})
export class PageLoadingComponent {}
