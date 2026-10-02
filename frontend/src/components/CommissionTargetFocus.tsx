"use client";
import { useEffect } from "react";

// 数据加载后再定位，兼容从其他页面跳入与本页 hash 导航。
export function CommissionTargetFocus() {
  useEffect(() => {
    const focus = () => {
      let id: string;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if (!id.startsWith("commission-")) return;
      const element = document.getElementById(id);
      element?.scrollIntoView({ block: "center" });
      element?.focus({ preventScroll: true });
    };
    const frame = requestAnimationFrame(focus);
    window.addEventListener("hashchange", focus);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", focus); };
  }, []);
  return null;
}
