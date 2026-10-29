/**
 * Minimal Chrome DevTools Protocol client over the browser's remote debugging port.
 *
 * Playwright only opens CDP sessions on pages, but memory has to be read from every
 * extension context: the service worker, the offscreen document, the popup and the
 * content scripts' host pages. The debugging port exposes all of them as targets.
 */

type Pending = { resolve: (result: any) => void; reject: (error: Error) => void };
type Listener = (params: any) => void;

/** One entry of the port's `/json/list`. */
export type Target = {
  id: string;
  type: string;
  url: string;
  title: string;
  webSocketDebuggerUrl: string;
};

export async function listTargets(port: number): Promise<Target[]> {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  return (await response.json()) as Target[];
}

export class CdpSession {
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private listeners = new Map<string, Listener[]>();

  private constructor(private socket: WebSocket) {
    socket.addEventListener("message", (event) => this.dispatch(String(event.data)));
  }

  static async connect(target: Target): Promise<CdpSession> {
    const socket = new WebSocket(target.webSocketDebuggerUrl);

    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error(`CDP connect: ${target.url}`)), {
        once: true,
      });
    });

    return new CdpSession(socket);
  }

  send<T = any>(method: string, params: object = {}): Promise<T> {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));

    return new Promise<T>((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  on(event: string, listener: Listener) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
  }

  close() {
    this.socket.close();
  }

  private dispatch(raw: string) {
    const message = JSON.parse(raw);

    if (message.id == null) {
      this.listeners.get(message.method)?.forEach((listener) => listener(message.params));
      return;
    }

    const pending = this.pending.get(message.id);
    this.pending.delete(message.id);

    if (message.error != null) {
      pending?.reject(new Error(`${message.error.message} (${message.error.code})`));
      return;
    }

    pending?.resolve(message.result);
  }
}
