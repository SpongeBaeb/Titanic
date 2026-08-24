import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  weight: ['400', '600', '700'],
  subsets: ["latin"],
  variable: "--font-cormorant",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "TITANIC SURVIVAL SIMULATOR",
  description: "1912년 4월 15일 밤, 내가 어떤 인간이었을지 발견하는 경험.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${cormorant.variable} ${inter.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col font-sans bg-ocean-black text-ivory selection:bg-brass/30">
        {children}
        <Script src="https://t1.kakaocdn.net/kakao_js_sdk/2.6.0/kakao.min.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
