import { T, Var, Num } from 'tyndale-react';

export function Parity(props: { user: string; count: number }) {
  const { user, count } = props;
  return (
    <T>
      Hello <Var name="user">{user}</Var>, &amp; welcome.
      You have <Num value={count}>{count}</Num>
      <strong>new</strong> items.
    </T>
  );
}
