
'use client';

import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  const toggleLocale = () => {
    setLocale(locale === 'en' ? 'ru' : 'en');
  };

  return (
    <Button variant="ghost" size="sm" onClick={toggleLocale} className="w-12">
      {locale.toUpperCase()}
    </Button>
  );
}
