# logging-angular

Owned by: platform

Angular wrapper for [`@bitwarden/logging`](../logging/README.md). Provides `FlightRecorderService`, an
`@Injectable` subclass of `FlightRecorder` that wires SDK readiness automatically via
`SdkLoadService.Ready`.

## Usage

```typescript
import { FlightRecorderService } from "@bitwarden/logging-angular";

@Component({
  /* ... */
})
export class MyComponent {
  private recorder = inject(FlightRecorderService);

  async viewEvents() {
    const events = await this.recorder.read();
  }
}
```

See [`@bitwarden/logging`](../logging/README.md) for the full API surface inherited by this service.
