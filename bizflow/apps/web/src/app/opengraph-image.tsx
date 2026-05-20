import { ImageResponse } from "next/og";

/**
 * Auto-generated OG image using Next.js convention.
 * Next.js detects this file and automatically:
 *  1. Generates the image at build time
 *  2. Adds the correct <meta property="og:image"> tag
 *
 * Served at /opengraph-image (auto-routed by Next.js)
 */

// Edge runtime removed to avoid Next.js 16/Turbopack node module incompatibilities
// export const runtime = "edge";
export const alt = "BizFlow — Business Management Suite";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0d0d1a 0%, #13131f 40%, #1a1a2e 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background orbs */}
        <div
          style={{
            position: "absolute",
            top: "-80px",
            left: "100px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-100px",
            right: "120px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "200px",
            right: "300px",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          {/* Logo icon */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "72px",
              height: "72px",
              borderRadius: "20px",
              background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
              boxShadow: "0 20px 60px rgba(139,92,246,0.3)",
              marginBottom: "28px",
            }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
              <path d="M2 7h20" />
              <path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
            </svg>
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: "64px",
              fontWeight: 800,
              background: "linear-gradient(135deg, #ffffff 0%, #c4b5fd 100%)",
              backgroundClip: "text",
              color: "transparent",
              letterSpacing: "-2px",
              lineHeight: 1.1,
              marginBottom: "16px",
            }}
          >
            BizFlow
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: "24px",
              fontWeight: 400,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.5px",
              marginBottom: "40px",
            }}
          >
            Business Management Suite
          </div>

          {/* Feature pills */}
          <div
            style={{
              display: "flex",
              gap: "12px",
            }}
          >
            {["Inventory", "Sales & Billing", "GST Reports", "Employee Mgmt"].map(
              (label) => (
                <div
                  key={label}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "99px",
                    background: "rgba(139,92,246,0.12)",
                    border: "1px solid rgba(139,92,246,0.2)",
                    color: "rgba(196,181,253,0.8)",
                    fontSize: "15px",
                    fontWeight: 500,
                  }}
                >
                  {label}
                </div>
              )
            )}
          </div>
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: "4px",
            background: "linear-gradient(90deg, #8b5cf6, #a78bfa, #c4b5fd, #a78bfa, #8b5cf6)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
