# Angular patterns

## Observable Data Services (ADR-0003):

```typescript
// Service exposes Observable streams
private _data$ = new BehaviorSubject<Data[]>([]);
readonly data$ = this._data$.asObservable();

// Component uses async pipe
data$ = this.dataService.data$;
// Template: <div *ngFor="let item of data$ | async">
```

## Subscription cleanup (required for explicit subscriptions)

```typescript
constructor() {
  this.observable$.pipe(takeUntilDestroyed()).subscribe(...);
}
```

## Angular Signals (ADR-0027):

Use Angular Signals only in components and presentational services. Use RxJS for cross-client services and complex reactive workflows.

## Component Change Detection

Use `OnPush` change detection strategy for all components.
