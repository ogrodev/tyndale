import { createTyndaleMiddleware } from 'tyndale-next/middleware';

export default createTyndaleMiddleware();

export const config = {
  matcher: ['/((?!api|_next|_tyndale|.*\\..*).*)'],
};
