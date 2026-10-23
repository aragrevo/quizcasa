import type { Metadata, Viewport } from "next";
// Fuente empaquetada localmente: evita el fallo de next/font/google con Turbopack
// y sigue funcionando sin conexión dentro de la PWA.
import "@fontsource-variable/nunito";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuizCasa",
  description: "Quizzes para estudiar a partir de fotos del cuaderno",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "QuizCasa", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#46178f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="antialiased min-h-dvh">{children}</body>
    </html>
  );
}
