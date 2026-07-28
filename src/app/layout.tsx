import type { Metadata } from "next";
import "@/app/globals.css";
import { AppToaster } from "@/components/ui/app-toaster";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "ClassPulse — Presence, made visible",
    template: "%s · ClassPulse",
  },
  description:
    "Modern classroom attendance with teacher-owned classes, live location and rotating ultrasonic verification, and clear analytics.",
  keywords: [
    "attendance management",
    "classroom attendance",
    "student analytics",
    "geolocation attendance",
  ],
  openGraph: {
    title: "ClassPulse — Presence, made visible",
    description:
      "Fast check-ins, stronger proximity verification, and useful attendance insights.",
    type: "website",
    images: [
      {
        url: "/og-v2.png",
        width: 1738,
        height: 905,
        alt: "ClassPulse — Presence, made visible.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ClassPulse — Presence, made visible",
    description:
      "Fast check-ins, stronger proximity verification, and useful attendance insights.",
    images: ["/og-v2.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("classpulse-theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.classList.toggle("dark",t==="dark");document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
