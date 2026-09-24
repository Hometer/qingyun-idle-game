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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('qingyun_theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);if(localStorage.getItem('qingyun_reduce_motion')==='1'){document.documentElement.classList.add('reduce-motion');}}catch(e){}})();`,
          }}
        />
        <GameProvider>
          <Shell>{children}</Shell>
        </GameProvider>
      </body>
    </html>
  );
}
