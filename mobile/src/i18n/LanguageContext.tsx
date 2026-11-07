import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import * as SessionStore from "../components/SessionStore";

const LANGUAGE_KEY = "motexa_language";

import {
  Language,
  translations,
} from "./translations";

type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (typeof translations)["en"] | (typeof translations)["ar"];
  isArabic: boolean;
};

const LanguageContext =
  createContext<LanguageContextType | undefined>(undefined);

type LanguageProviderProps = {
  children: ReactNode;
};

export function LanguageProvider({
  children,
}: LanguageProviderProps) {
  const [language, setLanguageState] =
    useState<Language>("en");

  // remembered like the appearance mode: SecureStore on a phone, the tab's session storage on web
  useEffect(() => {
    SessionStore.getItemAsync(LANGUAGE_KEY).then((v) => { if (v === "en" || v === "ar") setLanguageState(v); }).catch(() => {});
  }, []);
  const setLanguage = (next: Language) => {
    setLanguageState(next);
    SessionStore.setItemAsync(LANGUAGE_KEY, next).catch(() => {});
  };

  const toggleLanguage = () => setLanguage(language === "en" ? "ar" : "en");

  const value: LanguageContextType = {
    language,
    setLanguage,
    toggleLanguage,
    t: translations[language],
    isArabic: language === "ar",
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage must be used inside LanguageProvider"
    );
  }

  return context;
}