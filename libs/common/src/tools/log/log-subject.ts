import { Observable, Observer, ReplaySubject, SubjectLike, Subscription, Unsubscribable, map } from "rxjs";

import { EcsFormat } from "./ecs-format";
import { LogKey } from "./log-key";
import { LogSubjectDependencyProvider } from "./log-subject-dependency-provider";

/** A subject that captures the last N values it observes.
 *  Subscribers use one of several endpoints to retrieve values.
 *
 *  `LogSubject$`: monitoring the LogSubject directly emits all captured
 *     values individually (like `ReplaySubject`).
 *  `LogSubject.window$(size:number)`: emit captured values in blocks less than or equal
 *    to the size of the capture buffer.
 *  `LogSubject.new$`: emit values received after the subscription occurs
 */
export class LogSubject<LogFormat extends EcsFormat>
  extends Observable<LogFormat>
  implements SubjectLike<LogFormat>
{
  constructor(
    private key: LogKey<LogFormat>,
    private providers: LogSubjectDependencyProvider
  ) {
    super();
  }

  // window$(size:number) : Observable<LogFormat[]>;
  // new$(size:number) : Observable<LogFormat>;

  next(value: LogFormat) {
    this.input?.next(value);
  }

  error(err: any) {
    this.input?.error(err);
  }

  complete() {
    this.input?.complete();
  }

  /** Subscribe to the subject's event stream
   * @param observer listening for events
   * @returns the subscription
   */
  subscribe(observer?: Partial<Observer<LogFormat>> | ((value: LogFormat) => void) | null): Subscription {
    return this.output.pipe(map((log) => log)).subscribe(observer);
  }

  // using subjects to ensure the right semantics are followed;
  // if greater efficiency becomes desirable, consider implementing
  // `SubjectLike` directly
  private input? = new ReplaySubject<LogFormat>(this.key.size);
  private readonly output = new ReplaySubject<LogFormat>(this.key.size);

  private inputSubscription?: Unsubscribable;
  private outputSubscription?: Unsubscribable;

  private get isDisposed() {
    return this.input === null;
  }

  private dispose() {
    if (!this.isDisposed) {
      this.providers.log.debug("disposing LogSubject");

      // clean up internal subscriptions
      this.inputSubscription?.unsubscribe();
      this.outputSubscription?.unsubscribe();
      this.inputSubscription = undefined;
      this.outputSubscription = undefined;

      // drop input to ensure its value is removed from memory
      this.input = undefined;

      this.providers.log.debug("disposed LogSubject");
    }
  }
}
