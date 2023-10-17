import { Component, OnDestroy, OnInit } from "@angular/core";
import { action } from "@storybook/addon-actions";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import {
  BehaviorSubject,
  delay,
  firstValueFrom,
  of,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";

import { ButtonModule } from "../button";
import { IconButtonModule } from "../icon-button";

import { AsyncContextService } from "./async-context.service";
import { BitAsyncClickDirective } from "./bit-async-click.directive";
import { BitAsyncDisableDirective } from "./bit-async-disable.directive";
import { BitAsyncEvent } from "./bit-async-event";

@Component({
  template: `<ng-container *ngIf="initialLoading">Loading...</ng-container>
    <ng-container *ngIf="!initialLoading">
      <button bitButton buttonType="primary" [bitAsyncClick]="action" class="tw-ml-2">
        Perform action
      </button>
      <button bitButton buttonType="secondary" (bitAsyncClick)="refresh($event)" class="tw-ml-2">
        Refresh
      </button>
    </ng-container>`,
  selector: "app-initial-data-fetch-example",
  providers: [AsyncContextService],
})
class InitialDataFetchExampleComponent implements OnInit {
  private fakeDataService = createFakeDataService();

  protected initialLoading = true;
  protected fakeData: number;

  constructor(private asyncContextService: AsyncContextService) {}

  async ngOnInit(): Promise<void> {
    this.initialLoading = true;
    await this.load();
    this.initialLoading = false;
  }

  refresh(event?: BitAsyncEvent) {
    this.asyncContextService.execute(event, this.load.bind(this));
  }

  protected async load() {
    this.fakeData = await firstValueFrom(this.fakeDataService.getData$());
  }

  action = async () => {
    await new Promise<void>((resolve, reject) => {
      setTimeout(resolve, 2000);
    });
  };
}

@Component({
  template: `<ng-container *ngIf="initialLoading">Loading...</ng-container>
    <ng-container *ngIf="!initialLoading">
      <button bitButton buttonType="primary" [bitAsyncClick]="action" class="tw-ml-2">
        Perform action
      </button>

      <button
        bitButton
        buttonType="secondary"
        (click)="refresh()"
        [loading]="refreshing"
        class="tw-ml-2"
      >
        Refresh
      </button>
    </ng-container>`,
  selector: "app-reactive-data-refresh-example",
  providers: [AsyncContextService],
})
class ReactiveDataRefreshExampleComponent implements OnInit, OnDestroy {
  private fakeDataService = createFakeDataService();
  private destroy$ = new Subject<void>();
  private refresh$ = new BehaviorSubject<void>(undefined);

  protected initialLoading = true;
  protected refreshing = false;
  protected data: number;

  constructor(private asyncContextService: AsyncContextService) {}

  ngOnInit(): void {
    this.refresh$
      .pipe(
        tap(() => {
          this.refreshing = true;
          this.asyncContextService.loading = true;
        }),
        switchMap(() => this.fakeDataService.getData$()),
        takeUntil(this.destroy$)
      )
      .subscribe((data) => {
        this.refreshing = false;
        this.initialLoading = false;
        this.asyncContextService.loading = false;
        this.data = data;
      });
  }

  refresh() {
    this.refresh$.next();
  }

  action = async () => {
    await new Promise<void>((resolve, reject) => {
      setTimeout(resolve, 2000);
    });
  };

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

export default {
  title: "Component Library/Async Actions/Data Fetching",
  decorators: [
    moduleMetadata({
      declarations: [
        BitAsyncClickDirective,
        BitAsyncDisableDirective,
        InitialDataFetchExampleComponent,
        ReactiveDataRefreshExampleComponent,
      ],
      imports: [ButtonModule, IconButtonModule],
      providers: [
        {
          provide: ValidationService,
          useValue: {
            showError: action("ValidationService.showError"),
          } as Partial<ValidationService>,
        },
        {
          provide: LogService,
          useValue: {
            error: action("LogService.error"),
          } as Partial<LogService>,
        },
      ],
    }),
  ],
} as Meta;

type InitialDataFetchStory = StoryObj<InitialDataFetchExampleComponent>;
type ReactiveDataRefreshStory = StoryObj<ReactiveDataRefreshExampleComponent>;

export const InitialDataFetch: InitialDataFetchStory = {
  render: (args) => ({
    props: args,
    template: `<app-initial-data-fetch-example />`,
  }),
};

export const ReactiveDataWithRefresh: ReactiveDataRefreshStory = {
  render: (args) => ({
    props: args,
    template: `<app-reactive-data-refresh-example />`,
  }),
};

function createFakeDataService() {
  return {
    data: 0,
    getData$() {
      return of(this.data++).pipe(delay(5000));
    },
  };
}
