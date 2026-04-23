# Code Review

Verdict: incorrect

## Findings

### [P1] `drainStream()` can hang forever on normal buffered writes
In `packages/tyndale/src/cli.ts:217-228`, the new shutdown path assumes `writableLength > 0` means a later `'drain'` event will fire. That is not how Node streams work: `'drain'` is only guaranteed after backpressure, i.e. when a prior `write()` returned `false` and `writableNeedDrain` is `true`. A stream can have buffered bytes with `writableLength > 0` while `writableNeedDrain === false`; once those bytes flush, no `'drain'`, `'close'`, or `'error'` event follows. In that case `await drainStdio()` never resolves, so the CLI hangs after completing a command.

Impact: commands that print output to a pipe or redirected stream can now deadlock in the new exit path, which is worse than the original behavior.

Evidence: validated separately in Node with a writable stream showing buffered data (`writableLength: 4096`) and `writableNeedDrain: false`, and no `'drain'` event before the buffer emptied.
