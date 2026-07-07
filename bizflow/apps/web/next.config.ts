import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: any = {
  serverExternalPackages: ['@react-pdf/renderer'],

  // Strict environment validation during build/startup
  env: (() => {
    // Skip validation during Vercel builds as some vars might be runtime-only
    if (process.env.NODE_ENV === 'production' && !process.env.SKIP_ENV_VALIDATION && !process.env.VERCEL) {
      const required = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'RESEND_API_KEY'];
      const missing = required.filter(key => !process.env[key]);
      if (missing.length > 0) {
        throw new Error(`\n❌ Deployment Failed: Missing required environment variables:\n${missing.join(', ')}\n`);
      }
    }
    return {};
  })(),

  // I-3 FIX: Use absolute path to silence turbopack workspace detection warning
  turbopack: {
    root: resolve(process.cwd(), '../../'),
  },

  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: { instrumentationHook: true },

  // Security headers to prevent clickjacking, MIME sniffing, XSS, and content injection
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection',        value: '1; mode=block' },
          { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // I-7 FIX: Content Security Policy — mitigates XSS even if a vulnerability is introduced
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",    // Next.js requires unsafe-inline/eval
              "style-src 'self' 'unsafe-inline'",                    // Tailwind injects inline styles
              "img-src 'self' data: blob: https:",                   // data: for QR codes, blob: for PDFs
              "font-src 'self' https://fonts.gstatic.com",           // Google Fonts
              "connect-src 'self' https://generativelanguage.googleapis.com https://*.upstash.io", // Gemini AI + Upstash
              "frame-ancestors 'none'",                              // Duplicate of X-Frame-Options for CSP2
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

