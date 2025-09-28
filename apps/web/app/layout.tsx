import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { ThemeProvider } from 'next-themes';
import QueryProvider from '@/components/QueryProvider'; // Import the new provider
import './styles/globals.css';
import React from 'react';
import Header from '@/components/Header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Memorykeeper',
  description: 'Your voice-enabled photo memory vault.',
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
            <QueryProvider> {/* Use the new client component provider */}
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-grow container mx-auto p-4">
                  {children}
                </main>
              </div>
            </QueryProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}