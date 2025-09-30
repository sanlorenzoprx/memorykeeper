'use client';

import React from 'react';
import Link from 'next/link';
import { UserButton, SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs';
import { Button } from './ui/button';
import LanguageSwitcher from './LanguageSwitcher';
import { useI18n } from '@/contexts/I18nProvider';

export default function Header() {
  const { language, setLanguage, t } = useI18n();

  return (
    <header className="border-b">
      <div className="container mx-auto flex items-center justify-between p-4">
        <Link href="/" className="text-2xl font-bold">
          MemoryKeeper
        </Link>
        <nav className="flex items-center gap-4">
          <SignedIn>
            <Link href="/memories">
              <Button variant="ghost">{t('nav.memories')}</Button>
            </Link>
            <Link href="/albums">
              <Button variant="ghost">{t('nav.albums')}</Button>
            </Link>
            <LanguageSwitcher currentLang={language} onLanguageChange={setLanguage} />
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="ghost">{t('nav.signIn', { defaultValue: 'Sign In' })}</Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button>{t('nav.signUp', { defaultValue: 'Sign Up' })}</Button>
            </SignUpButton>
            <LanguageSwitcher currentLang={language} onLanguageChange={setLanguage} />
          </SignedOut>
        </nav>
      </div>
    </header>
  );
}