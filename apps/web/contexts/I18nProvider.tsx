'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeLanguage, isSupportedLanguage } from '@/lib/language-detection';

interface I18nContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string, options?: any) => string;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

interface I18nProviderProps {
  children: React.ReactNode;
  initialLanguage?: string;
}

export function I18nProvider({ children, initialLanguage = 'en' }: I18nProviderProps) {
  const [language, setLanguageState] = useState(initialLanguage);
  const [isLoading, setIsLoading] = useState(true);
  const [translations, setTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    const initI18n = async () => {
      try {
        let detectedLanguage = initialLanguage;

        // Try to detect optimal language if not explicitly set
        if (initialLanguage === 'auto') {
          detectedLanguage = await initializeLanguage();
        }

        // Ensure the language is supported
        if (!isSupportedLanguage(detectedLanguage)) {
          console.warn(`Language ${detectedLanguage} not supported, falling back to English`);
          detectedLanguage = 'en';
        }

        setLanguageState(detectedLanguage);

        // Load translations
        const response = await fetch(`/locales/${detectedLanguage}/common.json`);
        if (response.ok) {
          const translationsData = await response.json();
          setTranslations(translationsData);
        }
      } catch (error) {
        console.error('Failed to initialize i18n:', error);
        setLanguageState('en');
      } finally {
        setIsLoading(false);
      }
    };

    initI18n();
  }, [initialLanguage]);

  const setLanguage = async (newLanguage: string) => {
    if (!isSupportedLanguage(newLanguage)) {
      console.warn(`Language ${newLanguage} not supported`);
      return;
    }

    try {
      setIsLoading(true);
      setLanguageState(newLanguage);

      // Load new translations
      const response = await fetch(`/locales/${newLanguage}/common.json`);
      if (response.ok) {
        const translationsData = await response.json();
        setTranslations(translationsData);
      }

      // Store language preference
      if (typeof window !== 'undefined') {
        localStorage.setItem('memorykeeper-language', newLanguage);
      }
    } catch (error) {
      console.error('Failed to change language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const t = (key: string, options?: any): string => {
    const keys = key.split('.');
    let value = translations;

    for (const k of keys) {
      value = value?.[k];
    }

    if (typeof value !== 'string') {
      console.warn(`Translation key "${key}" not found`);
      return key;
    }

    // Simple interpolation for variables
    if (options) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return options[varName] !== undefined ? String(options[varName]) : match;
      });
    }

    return value;
  };

  const contextValue: I18nContextType = {
    language,
    setLanguage,
    t,
    isLoading,
  };

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}
