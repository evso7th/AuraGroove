
import 'server-only';
import type { Locale } from '@/types/i18n';

const dictionaries = {
  en: () => import('@/lib/dictionaries/en').then((module) => module.dictionary),
  ru: () => import('@/lib/dictionaries/ru').then((module) => module.dictionary),
};

export const getDictionary = async (locale: Locale) => {
  const dictionaryLoader = dictionaries[locale] ?? dictionaries.en;
  return dictionaryLoader();
};
