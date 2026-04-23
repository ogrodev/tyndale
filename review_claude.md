# Code Review: `packages/tyndale/src/cli.ts`

Reviewed the diff with full file context.

## Findings

### 🔴 High — `drainStream` can hang on POSIX pipes

`drainStream` waits for the `'drain'` event when `writableLength > 0`, but `'drain'` is only emitted after a prior `write()` returned `false` (i.e. the queue crossed the high-water mark). If the CLI's final output is buffered but never exceeded HWM, `writableLength` can be non-zero while `'drain'` will **never fire**. The `'close'` / `'error'` fallbacks on `process.stdout` also don't fire during normal exit, so the function can block indefinitely, preventing the subsequent `process.exit(exitCode)` from running.

This is exactly the scenario this change is trying to solve (POSIX pipes, where `process.stdout` is asynchronous per the Node docs on [process I/O](https://nodejs.org/api/process.html#a-note-on-process-io)). On Windows pipes, writes are synchronous so `writableLength` is usually already 0 and the check short-circuits — so the bug mostly bites Linux/macOS, which is also where you most want piped output to be intact.

Reference: [Event: 'drain'](https://nodejs.org/api/stream.html#event-drain) — "If a call to `stream.write(chunk)` returns `false`, the `'drain'` event will be emitted when it is appropriate to resume writing data to the stream."

**Fix**: use the `write(chunk, callback)` callback, which fires after the chunk is flushed to the underlying resource, regardless of backpressure state:

```ts
function drainStream(stream: NodeJS.WriteStream): Promise<void> {
  if (stream.writableEnded || stream.destroyed || stream.writableLength === 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => resolve();
    // write callback fires after buffered data is flushed
    stream.write('', done);
    stream.once('close', done);
    stream.once('error', done);
  });
}
```

This is the canonical "flush stdout before exiting" pattern and does not depend on HWM having been exceeded.

### 🟡 Medium — Listener accumulation on `process.stdout` / `stderr`

`stream.once('close', done)` and `stream.once('error', done)` are registered on the real `process.stdout` / `process.stderr`. In the common path, `'drain'` (or the `write` callback, if you adopt the fix above) resolves, and `'close'` / `'error'` listeners are never removed — they leak for the lifetime of the process. That's tolerable here because `process.exit` runs immediately after, but if `runCliEntrypoint` is ever reused (e.g. invoked twice in tests) it leaks per invocation and can trip Node's `MaxListenersExceededWarning`. Minor, but cheap to fix: remove the siblings when one resolves.

```ts
return new Promise((resolve) => {
  const cleanup = () => {
    stream.off('drain', cleanup);
    stream.off('close', cleanup);
    stream.off('error', cleanup);
    resolve();
  };
  stream.once('drain', cleanup);
  stream.once('close', cleanup);
  stream.once('error', cleanup);
});
```

### 🟡 Medium — Design reversal without evidence in-tree

The removed comment was explicit: "If any subsystem leaves handles open, fix the cleanup there — don't paper over it by hard-killing the process here." The new comment names three suspects (undici HTTP pools, proper-lockfile, readline/TUI stdin) but adds no test, repro, or tracking reference. That's fine tactically — Windows event-loop hangs in CLIs driven by undici and interactive TUIs are a well-known pattern — but it means the next person who adds a command won't know the contract is now "we will hard-exit you, clean up or not".

Consider either:
- A one-line comment on `routeCommand` saying "handles left open are fine; `runCliEntrypoint` force-exits after stdio drain", or
- A `FIXME(handles)` with a link to where each subsystem should eventually add cleanup.

This is a readability/maintainability concern, not a correctness one — but the old comment existed precisely because someone else will be tempted to revisit this decision.

### 🟢 Low — Error path prints full stack unconditionally

```ts
const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
console.error(message);
```

For user-facing CLI errors (bad flags, missing auth, etc.) a stack trace is noise; for unexpected errors it's essential. Consider gating on `process.env.TYNDALE_DEBUG` or an existing verbose flag, falling back to `err.message` by default. Not a blocker, but worth aligning with however the individual command handlers already surface errors (they likely already format user-friendly messages themselves, in which case a stack here for a caught user-error becomes double-reporting).

### 🟢 Low — `parseArgs` is inside the `try`

`parseArgs` can realistically only throw on truly malformed input (it doesn't today, from the code I read). Fine as-is, but note that a `parseArgs` failure now produces a stack trace instead of the friendly `printHelp()` / `printUnknownCommand` path. If you ever add validation there, make sure it throws a typed error you can format nicely rather than letting it fall into this generic catch.

---

## Verdict

**Request changes.**

The high-severity issue (`drainStream` waiting on `'drain'` when no backpressure occurred) defeats the purpose of the change on POSIX pipes — it can block the very `process.exit` call that was added to guarantee termination. Swapping to the `write('', callback)` pattern is a one-line fix and restores the intended behavior. The medium/low items are worth addressing in the same change but are not blockers.
