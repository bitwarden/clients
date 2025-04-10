import { firstValueFrom, Subject } from "rxjs";

export class MessageQueue<T> {
  private queue: T[] = [];
  private messageAvailable$ = new Subject<void>();

  async enqueue(message: T): Promise<void> {
    this.queue.push(message);
    this.messageAvailable$.next();
  }

  async dequeue(): Promise<T> {
    if (this.queue.length > 0) {
      return this.queue.shift() as T;
    }

    await firstValueFrom(this.messageAvailable$);
    return this.queue.shift() as T;
  }
}
