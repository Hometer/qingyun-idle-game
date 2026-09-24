import type { Metadata } from "next";
import "./globals.css";
import { GameProvider } from "@/lib/game-context";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "青云修仙录",
  description: "单机修仙文字放置游戏",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-paper text-ink">
        <GameProvider>
          <Shell>{children}</Shell>
        </GameProvider>
      </body>
    </html>
  );
}
