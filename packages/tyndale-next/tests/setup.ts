// Shared test setup: mock next/navigation for all tests that import client-provider
import { mock } from 'bun:test';

const mockPush = mock(() => {});
const mockRouter = {
  push: mockPush,
  replace: mock(() => {}),
  back: mock(() => {}),
  forward: mock(() => {}),
  refresh: mock(() => {}),
  prefetch: mock(() => {}),
};

mock.module('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));
