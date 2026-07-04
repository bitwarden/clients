# messaging

Owned by: platform

Services for sending and recieving messages from different contexts of the same application.

## Usage

The best way to use messaging is along with a `CommandDefinition` to help encourage type safety on
either side of the message. An overload of `MessageSender.send` exists that takes a `string` for the
command and a `Record<string, unknown>` for the payload, this exists for backwards compatibility but
all new uses are highly encouraged to use the `CommandDefinition<T>` overload.

```typescript
import { MessageSender, MessageListener, CommandDefinition } from "@bitwarden/messaging";

const MY_MESSAGE = new CommandDefinition<{ data: number }>("myMessage");
const MY_EVENT = new CommandDefinition<{ name: string }>("myEvent");

class MyService {
  myEvent$: Observable<{ name: string }>;

  contructor(private messageSender: MessageSender, private messageListener: MessageListener) {
    this.myEvent$ = this.messageListener.messages$(MY_EVENT);
  }

  async doThing() {
    this.messageSender.send(MY_MESSAGE, { data: 5 });
  }
}
```

## Implementation

### MessageSender

MessageSender has 4 implementations to help sending messages to all the different contexts of a
Bitwarden application.

#### SubjectMessageSender

The `SubjectMessageSender` takes an rxjs `Subject` and nexts the given payload along with a
`command` property with the given command name.

#### MultiMessageSender

This implementation just takes an array of other `MessageSender` implementations and sends all the
messages it gets to all of those implementations. This exists especially so we can use a
`SubjectMessageSender` to handle messages from the same context and use another client specific
implementation to handle messages with another context.

#### ChromeMessageSender

This implementation uses [`chrome.runtime.sendMessage`][chrome-runtime-sendMessage] to send messages
to other contexts of our browser extension. This API is the only one of the bunch that is
asynchronous under the hood but since the `send` method forces all `MessageSender`s to be sync. We
take care of this by handling the promise through logging.

### ElectronMainMessageSender

This implementation sends messages through the electron
[`BrowserWindow.webContents.send`][electron-send] API. This makes the message available through
listeners added in the `ipcRenderer.addListener` API.

### MessageListener

#### Observable

There is only one implementation implementation of `MessageListener` and it just takes an observable
of all messages. Similar to how `MultiMessageSender` sends messages to multiple sources this
listener can listen to multiple sources by using the RXJS operator `merge` to listen to multiple
observable sources of messages. So far all of our message sources are able to be converted pretty
easily to observables using some type of `fromEventPattern` function.

#### Subject

The same subject that is passed to `SubjectMessageSender` can also be converted to an observable
using `asObservable()`.

#### `chrome.runtime.onMessage`

For browser, We use the `chrome.runtime.onMessage` API and convert it to an observable using
`fromChromeEvent`. Messages from this source are also tagged as being an external message (meaning
not the same exact context) such that consumers could filter them out using
`filter(isExternalMessage)`. When messages are read from this API in Angular contexts we also use
our `runInsideAngular` operator to force the messages into the Angular zone so that messages are
able to affect the UI without every consumer doing that themselves.

#### IPC

Similar to the extensions implementation the browser renderer process wraps `ipc.platform.onMessage`
to convert those messages into an observable.

[chrome-runtime-sendMessage]: [https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage]
[electron-send]: [https://www.electronjs.org/docs/latest/api/web-contents#contentssendchannel-args]
