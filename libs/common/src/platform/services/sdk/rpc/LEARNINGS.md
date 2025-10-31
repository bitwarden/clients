# RPC Learnings

## Getting root is tricky

Root can be different things. I naively used `Rc<BitwardenClient>` but that does not work for `userClient$` because that requires
a user id. We could fix this by allowing root to take parameters, but a more generic solution is to simply support remote observables.
If we did that then root could instead be `SdkService` which would allow us to call any method on the sdk service remotely.

## Proxies

The easiest way of using proxies to bridge the gap between local and remote code would be to implement a command for every proxy handler function and then just transfer those over to the server. However, I had the feeling that this would lead to a lot of unnecessary IPC calls, because e.g. calling a function `someObject.aFunction()` would actually result in 2 IPC calls: one to `get` `aFunction` and one to `call` it. I tried to be smart and use a sub-proxy for properties, but that ended up complicating things a lot.

Instead, we should try to use the simpler approach and try to optimize that instead, e.g. by batching multiple calls into one IPC call. One idea would be to have a command that takes an array of operations to perform on the remote side and then executes them in order, returning the final result. I'm thinking that this could be possible if we changed how proxies work to not immediately execute the operation, but instead build up a list of operations to perform. Then, when we actually need the result (an actual `await` is used), we can send the list of operations to the server and execute them there.

## Object references

Currently references are only support in one direction `client -> server`. This means that the client is not able to send object references to the server. This blocks any functionality that would require this, e.g. passing a callback function from the client to the server. This could also be used to implement observables.
