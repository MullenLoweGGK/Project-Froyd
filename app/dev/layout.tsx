import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Project Froyd — Dev / LiveAvatar",
  description:
    "Developer debug interface for the LiveAvatar integration. Not for public use.",
  robots: { index: false, follow: false },
};

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return children;
}
