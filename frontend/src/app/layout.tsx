import type { Metadata } from "next";
import "./globals.css";
import { GameProvider } from "@/lib/game-context";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "灵境修行｜大模型叙事修仙放置 RPG",
  description: "面向修仙题材放置 RPG 玩家，以挂机收益、战斗探索和角色成长构建核心玩法，通过 AI 剧情事件与分支任务丰富叙事体验，保障进度、奖励和经济结算稳定，并控制模型调用量。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-paper text-ink">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('qingyun_theme')||'dark';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);if(localStorage.getItem('qingyun_reduce_motion')==='1'){document.documentElement.classList.add('reduce-motion');}}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
        <GameProvider>
          <Shell>{children}</Shell>
        </GameProvider>
      </body>
    </html>
  );
}
