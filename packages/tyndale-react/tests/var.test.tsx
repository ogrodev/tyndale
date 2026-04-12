// packages/tyndale-react/tests/var.test.tsx
import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Var } from '../src/var';

describe('<Var>', () => {
  test('renders children as-is', () => {
    render(<Var name="user">Pedro</Var>);
    expect(screen.getByText('Pedro')).toBeTruthy();
  });

  test('renders complex children', () => {
    render(
      <Var name="greeting">
        <strong data-testid="bold">Hello</strong>
      </Var>,
    );
    expect(screen.getByTestId('bold').textContent).toBe('Hello');
  });

  test('exposes name prop for serializer identification', () => {
    const el = <Var name="user">Pedro</Var>;
    expect(el.props.name).toBe('user');
  });
});
