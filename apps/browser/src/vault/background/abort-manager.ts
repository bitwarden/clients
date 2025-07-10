type Runner<T> = (abortController: AbortController) => Promise<T>;

/**
 * Manages abort controllers for long running tasks and allow separate
 * execution contexts to abort each other by using ids.
 */
export class AbortManager {
  private abortControllers = new Map<string, AbortController>();

  runWithAbortController<T>(id: string, runner: Runner<T>): Promise<T> {
    const abortController = new AbortController();
    this.abortControllers.set(id, abortController);
    return runner(abortController).finally(() => {
      this.abortControllers.delete(id);
    });
  }

  abort(id: string) {
    this.abortControllers.get(id)?.abort();
  }
}
