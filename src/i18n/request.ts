import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';

const SUPPORTED = ['ko', 'en'] as const;
type Locale = typeof SUPPORTED[number];

function detectLocale(acceptLanguage: string): Locale {
  const preferred = acceptLanguage
    .split(',')
    .map(s => s.split(';')[0].trim().toLowerCase().slice(0, 2));

  for (const lang of preferred) {
    if ((SUPPORTED as readonly string[]).includes(lang)) return lang as Locale;
  }
  return 'ko';
}

export default getRequestConfig(async () => {
  const headersList = await headers();
  const locale = detectLocale(headersList.get('accept-language') ?? '');

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
