import { NgZone } from "@angular/core";
import { MonoTypeOperatorFunction, Observable } from "rxjs";

export function runInsideAngular<T>(ngZone: NgZone): MonoTypeOperatorFunction<T> {
  return (source: Observable<T>) =>
    new Observable<T>((subscriber) => {
      const subscription = source.subscribe({
        next(value) {
          ngZone.run(() => subscriber.next(value));
        },
        error(error: unknown) {
          ngZone.run(() => subscriber.error(error));
        },
        complete() {
          ngZone.run(() => subscriber.complete());
        },
      });

      return () => subscription.unsubscribe();
    });
}

// function now() {
//   const userId = "userId" as UserId;
//   const otherService: { someSetting: Observable<any> } = null;
//   const sdkService: DefaultSdkService = null;

//   combineLatest([otherService.someSetting, sdkService.userClient$(userId)]).subscribe(
//     ([someSetting, sdkClient]) => {
//       using client = sdkClient.take();
//       if (someSetting) {
//         client.value.echo("some setting");
//       } else {
//         client.value.echo("no setting");
//       }
//     },
//   );
// }

// function callback() {
//   const userId = "userId" as UserId;
//   const otherService: { someSetting: Observable<any> } = null;
//   const sdkService: DefaultSdkService = null;

//   someSetting.pipe(
//     switchMap((someSettings) =>
//       sdkService.userClientWithCallback$(userId, (client) => {
//         // take done in userClient With Callback while calling this callback
//         if (someSettings) {
//           client.echo("some setting");
//         } else {
//           client.echo("no setting");
//         }
//       }),
//     ),
//   );
// }

// function operator() {
//   const userId = "userId" as UserId;
//   const otherService: { someSetting: Observable<any> } = null;
//   const sdkService: DefaultSdkService = null;

//   someSetting.pipe(
//     sdkService.withUserClient, // this transforms the stream into [value, client] tuple while ensuring the client it taken
//   ).subscribe(([someSetting, client]) => {
//     if (someSetting) {
//       client.echo("some setting");
//     } else {
//       client.echo("no setting");
//     }
//   });
// }
