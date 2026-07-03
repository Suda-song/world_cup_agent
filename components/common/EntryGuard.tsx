"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * 入场守卫：只在页面刷新时把用户重定向回入场页 /。
 * 正常的 tab 切换/导航不受影响。
 *
 * 原理：
 * - 页面刷新（F5/Ctrl+R）会触发 beforeunload，此时写入 sessionStorage 的
 *   "refreshing" 标记；下一次 mount 时读到该标记说明是刷新，清除 wc_entered。
 * - 正常的 SPA 路由切换不会触发 beforeunload，所以标记不会被写入。
 */
export default function EntryGuard() {
  const pathname = usePathname();
  const router = useRouter();

  // 监听刷新：在 beforeunload 时写标记
  useEffect(() => {
    const markRefresh = () => {
      sessionStorage.setItem("wc_refreshing", "1");
    };
    window.addEventListener("beforeunload", markRefresh);
    return () => window.removeEventListener("beforeunload", markRefresh);
  }, []);

  // 检测是否因刷新进入（只在 mount 时跑一次）
  useEffect(() => {
    if (pathname === "/") return;

    const wasRefreshing = sessionStorage.getItem("wc_refreshing");
    const hasEntered = sessionStorage.getItem("wc_entered");

    if (wasRefreshing) {
      // 是刷新进来的，清除所有标记，重定向回入场页
      sessionStorage.removeItem("wc_refreshing");
      sessionStorage.removeItem("wc_entered");
      router.replace("/");
      return;
    }

    if (!hasEntered) {
      // 直接输入 URL 进来（没有 wc_entered），也回入场页
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
