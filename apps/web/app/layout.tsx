import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { ThemeProvider } from 'next-themes';
import QueryProvider from '@/components/QueryProvider';
import { I18nProvider } from '@/contexts/I18nProvider';
import { ToastProvider } from '@/components/ui/toast';
import './styles/globals.css';
import React from 'react';
import Header from '@/components/Header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MemoryKeeper - Your Voice-Enabled Photo Memory Vault',
  description: 'Transform your physical photos into digital memories with voice descriptions and AI enhancement.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <QueryProvider>
              <ToastProvider>
                <I18nProvider initialLanguage="auto">
                  <div className="flex flex-col min-h-screen">
                    <Header />
                    <main className="flex-grow">
                      {children}
                    </main>
                  </div>
                </I18nProvider>
              </ToastProvider>
            </QueryProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}