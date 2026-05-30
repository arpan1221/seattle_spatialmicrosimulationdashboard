"use client";

import { create } from "zustand";
import type { ClusterType, PercentileMethod } from "@/lib/data";

interface DashboardState {
  selectedModel: string;          // "df2"..."df11"
  clusterType: ClusterType;
  percentileMethod: PercentileMethod;
  hoveredGeoid: string | null;

  setSelectedModel: (m: string) => void;
  setClusterType: (c: ClusterType) => void;
  setPercentileMethod: (p: PercentileMethod) => void;
  setHoveredGeoid: (g: string | null) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedModel: "df2",
  clusterType: "yes",
  percentileMethod: "70th",
  hoveredGeoid: null,

  setSelectedModel: (m) => set({ selectedModel: m }),
  setClusterType: (c) => set({ clusterType: c }),
  setPercentileMethod: (p) => set({ percentileMethod: p }),
  setHoveredGeoid: (g) => set({ hoveredGeoid: g }),
}));
