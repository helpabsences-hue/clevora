"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** The chart library is only downloaded on the statistics page, after the page shows. */
export const RevenueChartLazy = dynamic(() => import("./revenue-chart").then((m) => m.RevenueChart), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full" />,
});
