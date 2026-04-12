import { T, Var } from 'tyndale-react';
import { useTranslation } from 'tyndale-react';

export default function Home({ userName }: { userName: string }) {
  const t = useTranslation();
  return (
    <div>
      <T>
        <h1>Welcome to <strong>our app</strong></h1>
        <p>Start building.</p>
      </T>
      <T>
        <p>Hello <Var name="user">{userName}</Var></p>
      </T>
      <input placeholder={t('Enter your email')} />
      <label>{t('Email address')}</label>
    </div>
  );
}
