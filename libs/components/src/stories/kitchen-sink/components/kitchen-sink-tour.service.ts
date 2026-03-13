import { Injectable, signal, WritableSignal } from "@angular/core";

@Injectable({ providedIn: "root" })
export class KitchenSinkTourService {
  readonly tourStep: WritableSignal<0 | 1 | 2 | 3> = signal(0);

  startTour(): void {
    this.tourStep.set(1);
  }

  nextStep(): void {
    this.tourStep.update((prev) => (prev > 0 && prev < 3 ? ((prev + 1) as 1 | 2 | 3) : 0));
  }

  endTour(): void {
    this.tourStep.set(0);
  }
}
