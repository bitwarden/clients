interface ExtendableEvent extends Event {
  waitUntil(f: Promise<unknown>): void;
}

interface PushEvent extends ExtendableEvent {
  // From PushEvent
  data: {
    arrayBuffer(): ArrayBuffer;
    blob(): Blob;
    bytes(): Uint8Array;
    json(): any;
    text(): string;
  };
}

// Register event listener for the 'push' event.
self.addEventListener("push", function (e: unknown) {
  const event: PushEvent = e as PushEvent;
  // Retrieve the textual payload from event.data (a PushMessageData object).
  // Other formats are supported (ArrayBuffer, Blob, JSON), check out the documentation
  // on https://developer.mozilla.org/en-US/docs/Web/API/PushMessageData.
  const payload = event.data ? event.data.text() : "no payload";

  // eslint-disable-next-line no-console -- temporary PoC code FIXME: handle payloads
  console.log("Received a push message with payload:", payload);
});
