import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { afterEach } from 'bun:test';

GlobalRegistrator.register();

// Clear DOM between tests without destroying the global document
afterEach(() => {
  document.body.innerHTML = '';
});
