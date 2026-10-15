import { useState, useEffect } from 'react';
import { translations } from './translations';

export type Language = 'ar' | 'en';

export function useTranslation() {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('voice_pro_lang');
    return (saved === 'en' || saved === 'ar') ? saved : 'ar';
  });

  const setLanguage = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('voice_pro_lang', newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const t = translations[lang];

  return {
    lang,
    setLanguage,
    t,
    isRtl: lang === 'ar',
  };
}
