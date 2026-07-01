import React, { createContext, useContext, useState, useCallback } from 'react';
import ptBR from './pt-BR';
import en from './en';

const LANGUAGES = { 'pt-BR': ptBR, 'en': en };
const LANGUAGE_LABELS = { 'pt-BR': 'Portugues', 'en': 'English' };

const I18nContext = createContext();

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('iss-editor-lang');
    return saved && LANGUAGES[saved] ? saved : 'pt-BR';
  });

  const t = useCallback((key) => {
    return LANGUAGES[lang]?.[key] || LANGUAGES['pt-BR']?.[key] || key;
  }, [lang]);

  const switchLang = useCallback((newLang) => {
    if (LANGUAGES[newLang]) {
      setLang(newLang);
      localStorage.setItem('iss-editor-lang', newLang);
    }
  }, []);

  return (
    <I18nContext.Provider value={{ t, lang, switchLang, languages: LANGUAGE_LABELS }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
