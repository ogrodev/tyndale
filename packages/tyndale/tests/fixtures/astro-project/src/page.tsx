import { msg, T } from 'tyndale-react';

const greeting = msg('Greeting from TSX');

export function Page() {
  return (
    <div>
      <T>Hello from TSX</T>
      <p>{greeting}</p>
    </div>
  );
}
