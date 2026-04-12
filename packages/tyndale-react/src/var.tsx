import type { VarProps } from './types';

/**
 * Dynamic text slot for use inside <T>.
 * Standalone: renders children. Inside <T>: serialized as {name} placeholder.
 */
export function Var({ children }: VarProps): React.JSX.Element {
  return <>{children}</>;
}
