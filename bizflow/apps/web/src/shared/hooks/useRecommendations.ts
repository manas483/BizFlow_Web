"use client";

import { useEffect, useState, useCallback } from "react";

interface ProductRecommendation {
  productId: string;
  name: string;
  category: string;
  reason: string;
  score: number;
  action: "reorder" | "promote" | "bundle" | "new";
}

interface QuickAction {
  id: string;
  label: string;
  href: string;
  icon: string;
  score: number;
}

interface SmartInsight {
  id: string;
  type: "warning" | "tip" | "success" | "info";
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

interface RecommendationResult {
  productRecommendations: ProductRecommendation[];
  quickActions: QuickAction[];
  insights: SmartInsight[];
  reorderAlerts: ProductRecommendation[];
}

const DEFAULT: RecommendationResult = {
  productRecommendations: [],
  quickActions: [],
  insights: [],
  reorderAlerts: [],
};

export function useRecommendations() {
  const [data, setData] = useState<RecommendationResult>(DEFAULT);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const res = await window.fetch("/api/recommendations");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silent fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, refetch: fetch };
}

// ─── Activity tracker (fire-and-forget) ──────────────────────────────────────
export function trackActivity(eventType: string, metadata?: Record<string, unknown>) {
  window.fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, metadata }),
  }).catch(() => {}); // never throws
}
