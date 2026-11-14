import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Toaster } from 'sonner';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'DedupeIQ — Intelligent Duplicate Record Detection System',
  description: 'Enterprise-grade 3NF master data deduplication and record linkage engine on PostgreSQL.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
        <Navbar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="border-t border-stone-200 dark:border-stone-800 py-4 text-center text-xs text-stone-500 dark:text-stone-400 font-mono">
          DedupeIQ Engine • College DBMS Project • PostgreSQL Neon 3NF Architecture
        </footer>
        <Toaster position="bottom-right" richColors theme="system" />
      </body>
    </html>
  );
}
