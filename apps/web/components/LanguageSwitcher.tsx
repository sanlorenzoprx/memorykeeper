'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Globe } from 'lucide-react';
import { getLanguageDisplayName, getOptimalLanguage } from '@/lib/language-detection';

interface LanguageSwitcherProps {
  currentLang: string;
  onLanguageChange: (lang: string) => void;
}

export default function LanguageSwitcher({ currentLang, onLanguageChange }: LanguageSwitcherProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLanguageChange = (newLang: string) => {
    onLanguageChange(newLang);
    // Update URL without full page reload
    const currentPath = window.location.pathname;
    const newUrl = currentPath.replace(/^\/[a-z-]{2,5}/, `/${newLang}`) || `/${newLang}`;
    window.history.replaceState({}, '', newUrl);
  };

  if (!mounted) {
    return (
      <Button variant="outline" size="sm">
        <Globe className="h-4 w-4 mr-2" />
        Language
      </Button>
    );
  }

  return (
    <Select value={currentLang} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-32">
        <Globe className="h-4 w-4 mr-2" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">English</SelectItem>
        <SelectItem value="es">Español</SelectItem>
        <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
        <SelectItem value="fr">Français</SelectItem>
        <SelectItem value="de">Deutsch</SelectItem>
        <SelectItem value="it">Italiano</SelectItem>
        <SelectItem value="ru">Русский</SelectItem>
        <SelectItem value="ar">العربية</SelectItem>
        <SelectItem value="zh-CN">中文 (简体)</SelectItem>
        <SelectItem value="zh-TW">中文 (繁體)</SelectItem>
        <SelectItem value="ja">日本語</SelectItem>
        <SelectItem value="ko">한국어</SelectItem>
        <SelectItem value="tr">Türkçe</SelectItem>
        <SelectItem value="id">Bahasa Indonesia</SelectItem>
        <SelectItem value="hi">हिन्दी</SelectItem>
      </SelectContent>
    </Select>
  );
}
