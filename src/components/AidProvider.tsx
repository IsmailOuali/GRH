"use client";

import { createContext, useContext } from "react";
import type { Holiday } from "@/lib/holidays";

/**
 * The Aïd days, loaded once by the dashboard layout. They are computed on the
 * server only, so the browser and the server can never count them differently.
 */
const AidContext = createContext<Holiday[]>([]);

export function AidProvider({ holidays, children }: { holidays: Holiday[]; children: React.ReactNode }) {
  return <AidContext.Provider value={holidays}>{children}</AidContext.Provider>;
}

export function useAidHolidays(): Holiday[] {
  return useContext(AidContext);
}
