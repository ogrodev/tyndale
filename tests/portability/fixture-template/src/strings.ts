import { msgString as msg } from 'tyndale-react';

// Two string-mode translatable sources. The portability E2E uses these to
// verify that `tyndale extract` runs under both Node and Bun against a real
// installed CLI (not the workspace dev harness).
export const strings = {
  greeting: msg('Hello, world.'),
  cta: msg('Get started with Tyndale.'),
};
