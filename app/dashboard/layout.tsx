import type { Metadata } from "next";
import Sidebar from "./Sidebar";

export const metadata: Metadata = {
  title: "Floe — Replay Console",
  description: "Inspect, fork, and replay agent traces.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-deep-space text-dim-starlight md:flex-row">
      <Sidebar />
      <main className="dash-scroll dash-grid flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
