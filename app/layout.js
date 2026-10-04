import "./globals.css";

export const metadata = {
  title: "Ganbur AI",
  description: "مساعد ذكاء اصطناعي عربي سريع وآمن",
};

export default function RootLayout({ children }) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
