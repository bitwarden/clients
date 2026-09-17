# performance-tracking-angular

Owned by: platform

Angular wrapper for [`@bitwarden/performance-tracking`](../performance-tracking/README.md). Provides
`PerformanceTrackingAngularService`, an `@Injectable` subclass of `DefaultPerformanceTrackingService`
that routes performance debug output to `LogService`.

## Usage

```typescript
import { PerformanceTrackingService } from "@bitwarden/performance-tracking";

@Component({/* ... */})
export class MyComponent {
  private performanceTracking = inject(PerformanceTrackingService);
}
```

See [`@bitwarden/performance-tracking`](../performance-tracking/README.md) for the full API surface.
