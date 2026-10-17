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
