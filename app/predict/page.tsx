"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 「晋级预测」已合并进「夺冠·晋级概率」页（/dashboard）。此处重定向，保留旧链接可用。
export default function PredictRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return (
    <div className="flex items-center justify-center py-20 text-sm text-muted">
      正在跳转到「夺冠·晋级概率」…
    </div>
  );
}
