import { Observable, Subscription, firstValueFrom, throwError, timeout } from "rxjs";

/** Test class to enable async awaiting of observable emissions */
export class ObservableTracker<T> {
  private subscription: Subscription;
  emissions: T[] = [];
  constructor(private observable: Observable<T>) {
    this.emissions = this.trackEmissions(observable);
  }

  /** Unsubscribes from the observable */
  unsubscribe() {
    this.subscription.unsubscribe();
  }

  /**
   * Awaits the next emission from the observable, or throws if the timeout is exceeded
   * @param msTimeout The maximum time to wait for another emission before throwing
   */
  async expectEmission(msTimeout = 50) {
    await firstValueFrom(
      this.observable.pipe(
        timeout({
          first: msTimeout,
          with: () => throwError(() => new Error("Timeout exceeded waiting for another emission.")),
        }),
      ),
    );
  }

  /** Awaits until the the total number of emissions observed by this tracker equals or exceeds {@link count}
   * @param count The number of emissions to wait for
   */
  async pauseUntilReceived(count: number, msTimeout = 50): Promise<T[]> {
    for (let i = 0; i < count - this.emissions.length; i++) {
      await this.expectEmission(msTimeout);
    }
    return this.emissions;
  }

  private trackEmissions<T>(observable: Observable<T>): T[] {
    const emissions: T[] = [];
    this.subscription = observable.subscribe((value) => {
      switch (value) {
        case undefined:
        case null:
          emissions.push(value);
          return;
        default:
          // process by type
          break;
      }

      switch (typeof value) {
        case "string":
        case "number":
        case "boolean":
          emissions.push(value);
          break;
        case "symbol":
          // Cheating types to make symbols work at all
          emissions.push(value.toString() as T);
          break;
        default: {
          emissions.push(clone(value));
        }
      }
    });
    return emissions;
  }
}
function clone(value: any): any {
  if (global.structuredClone != undefined) {
    return structuredClone(value);
  } else {
    return JSON.parse(JSON.stringify(value));
  }
}

/** A test helper that builds an @see{@link ObservableTracker}, which can be used to assert things about the
 * emissions of the given observable
 * @param observable The observable to track
 */
export function subscribeTo<T>(observable: Observable<T>) {
  return new ObservableTracker(observable);
}
