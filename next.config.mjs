/** @type {import('next').NextConfig} */
const devEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';

const nextConfig = {
  reactStrictMode: true,
  // Supports local Playwright/mobile checks without weakening production CSP.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Camera/mic only ever used by this origin, and only after explicit user consent.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            // Compatible CSP: Next needs inline scripts/styles; MediaPipe WASM
            // needs 'wasm-unsafe-eval'. No remote script frames are allowed.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${devEval} https://cdn.jsdelivr.net`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com https://*.firebasedatabase.app wss://*.firebaseio.com wss://*.firebasedatabase.app https://api.groq.com https://cdn.jsdelivr.net https://storage.googleapis.com https://*.upstash.io",
              "media-src blob:",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
