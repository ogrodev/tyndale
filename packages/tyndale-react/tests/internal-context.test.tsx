// packages/tyndale-react/tests/internal-context.test.tsx
import { describe, test, expect } from 'bun:test';
import React, { useContext } from 'react';
import { render, screen } from '@testing-library/react';
import {
  TyndaleInternalContext,
  type TyndaleInternalContextValue,
} from '../src/internal-context';

describe('TyndaleInternalContext', () => {
  test('provides setLocaleData and onLocaleChange to descendants', () => {
    let capturedCtx: TyndaleInternalContextValue | null = null;
    const setLocaleData = (_l: string, _t: Record<string, string>) => {};
    const onLocaleChange = (_l: string) => {};

    function Consumer() {
      capturedCtx = useContext(TyndaleInternalContext);
      return <div data-testid="consumer">ok</div>;
    }

    render(
      <TyndaleInternalContext.Provider
        value={{ setLocaleData, onLocaleChange, outputPath: '/_tyndale' }}
      >
        <Consumer />
      </TyndaleInternalContext.Provider>,
    );

    expect(screen.getByTestId('consumer')).toBeTruthy();
    expect(capturedCtx).not.toBeNull();
    expect(capturedCtx!.setLocaleData).toBe(setLocaleData);
    expect(capturedCtx!.onLocaleChange).toBe(onLocaleChange);
    expect(capturedCtx!.outputPath).toBe('/_tyndale');
  });

  test('defaults to null when no provider', () => {
    let capturedCtx: TyndaleInternalContextValue | null = 'not-null' as any;
    function Consumer() {
      capturedCtx = useContext(TyndaleInternalContext);
      return <div>ok</div>;
    }
    render(<Consumer />);
    expect(capturedCtx).toBeNull();
  });
});
