import type { Metadata, Viewport } from "next";
import "./globals.css";

const origin = "https://tinylink.techtideai.chatgpt.site";
const title = "TinyLink — Small links. Lasting impressions.";
const description =
  "Turn long URLs into memorable links. Create custom aliases, share with confidence, and see every click in one focused workspace.";
export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title,
  description,
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    url: origin,
    siteName: "TinyLink",
    title,
    description,
    images: [
      {
        url: "/brand/social-dark.png",
        width: 1200,
        height: 630,
        alt: "TinyLink. Small links. Lasting impressions. Create, share and understand your links.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/brand/social-dark.png"],
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: "#f7f9fa",
};

// Apply the saved two-state preference before first paint; default to light.
const themeInit = `try{const d=localStorage.getItem('tinylink-theme')==='dark';document.documentElement.dataset.theme=d?'dark':'light';document.querySelector('meta[name=theme-color]')?.setAttribute('content',d?'#090909':'#f7f9fa')}catch{}`;
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/InterVariable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
