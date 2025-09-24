
import type { Locale } from '@/types/i18n';
import { dictionary as enDictionary } from './dictionaries/en';
import { dictionary as ruDictionary } from './dictionaries/ru';

// This function is synchronous now, directly returning the imported object.
export const getDictionary = (locale: Locale) => {
  const dictionaries = {
    en: enDictionary,
    ru: ruDictionary,
  };
  return dictionaries[locale] ?? dictionaries.en;
};
