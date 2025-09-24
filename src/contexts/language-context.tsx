
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Locale } from '@/types/i18n';
import { getDictionary } from '@/lib/get-dictionary';
import type { Dictionary } from '@/lib/dictionaries/en';
import LoadingDots from '@/components/ui/loading-dots';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dictionary: Dictionary | null;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [locale, setLocale] = useState<Locale>('en');
  const [dictionary, setDictionary] = useState<Dictionary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedLocale = localStorage.getItem('aura-groove-locale') as Locale | null;
    if (savedLocale && (savedLocale === 'en' || savedLocale === 'ru')) {
      setLocale(savedLocale);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const dict = getDictionary(locale);
    setDictionary(dict);
    localStorage.setItem('aura-groove-locale', locale);
    setLoading(false);
  }, [locale]);

  const handleSetLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
  }, []);

  if (loading || !dictionary) {
    return <div className="flex min-h-screen items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale: handleSetLocale, dictionary, loading }}>
      {children}
    </LanguageContext.Provider>
  );
};
