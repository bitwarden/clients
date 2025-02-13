import { MessageQueue } from "./message-queue";

type Message = symbol;

describe("MessageQueue", () => {
  let messageQueue!: MessageQueue<Message>;

  beforeEach(() => {
    messageQueue = new MessageQueue<Message>();
  });

  it("waits for a new message when queue is empty", async () => {
    const message = createMessage();

    // Start a promise to dequeue a message
    let dequeuedValue: Message | undefined;
    void messageQueue.dequeue().then((value) => {
      dequeuedValue = value;
    });

    // No message is enqueued yet
    expect(dequeuedValue).toBeUndefined();

    // Enqueue a message
    await messageQueue.enqueue(message);

    // Expect the message to be dequeued
    await new Promise(process.nextTick);
    expect(dequeuedValue).toBe(message);
  });

  it("returns existing message when queue is not empty", async () => {
    const message = createMessage();

    // Enqueue a message
    await messageQueue.enqueue(message);

    // Dequeue the message
    const dequeuedValue = await messageQueue.dequeue();

    // Expect the message to be dequeued
    expect(dequeuedValue).toBe(message);
  });
});

function createMessage(name?: string): symbol {
  return Symbol(name);
}
