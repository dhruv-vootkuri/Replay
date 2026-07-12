import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Floe — Fork one input. See exactly what reruns.",
  description:
    "Floe traces every LLM call, tool call, and span your agent makes. Fork any point mid-trace and get a span-by-span diff of what changed.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
