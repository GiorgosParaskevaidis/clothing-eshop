import 'server-only';
import { cookies } from 'next/headers';
import { LANGUAGE_COOKIE, resolveLanguage, translate } from './translations';

export async function serverLanguage() {
  return resolveLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value);
}

export async function serverTranslator() {
  const language = await serverLanguage();
  return (text: string) => translate(language, text);
}
