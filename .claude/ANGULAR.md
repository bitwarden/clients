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

## Signals

Use Angular Signals only in components and presentational services. Use RxJS for cross-client services and complex reactive workflows.

## No TypeScript Enums (ADR-0025):

```typescript
// ✅ Correct
export const CipherType = Object.freeze({
  Login: 1,
  SecureNote: 2,
} as const);
export type CipherType = (typeof CipherType)[keyof typeof CipherType];

// ❌ Wrong - don't add new enums
enum CipherType {
  Login = 1,
}
```

## Component Change Detection

Use `OnPush` change detection strategy for all components.
