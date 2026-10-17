import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth/AuthProvider';

export const metadata: Metadata = {
  title: {
    default: 'ApexFit AI — Fitness & Nutrition OS',
    template: '%s · ApexFit AI',
  },
  description:
    'A futuristic, India-first AI fitness and nutrition platform: smart workouts, Indian food tracking, hydration, and an AI coach.',
  applicationName: 'ApexFit AI',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icon-192.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'ApexFit AI — Your Peak. Your Intelligence. Your Evolution.',
    description:
      'India-first fitness & nutrition: adaptive workouts, honest nutrition logging, privacy-first Arena leaderboards, and an AI coach you control.',
    siteName: 'ApexFit AI',
    type: 'website',
    // Intentionally no url/absolute images: no production domain is hard-coded.
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'ApexFit AI' }],
  },
  twitter: {
    card: 'summary',
    title: 'ApexFit AI — Your Peak. Your Intelligence. Your Evolution.',
    description: 'Adaptive workouts, honest nutrition logging and a privacy-first Arena — with an AI coach you control.',
    images: ['/icon-512.png'],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#04060e',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Ambient background — decorative, hidden from assistive tech */}
        <div className="app-aurora" aria-hidden="true">
          <div className="orb orb-a" />
          <div className="orb orb-b" />
          <div className="orb orb-c" />
        </div>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
