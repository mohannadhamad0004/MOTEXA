import {
  createContext,
  ReactNode,
  useContext,
  useState,
} from "react";

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
  const [language, setLanguage] =
    useState<Language>("en");

  const toggleLanguage = () => {
    setLanguage((currentLanguage) =>
      currentLanguage === "en" ? "ar" : "en"
    );
  };

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