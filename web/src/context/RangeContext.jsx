import { createContext, useContext, useState } from "react";

const RangeContext = createContext({ range: "today", setRange: () => {} });

const RANGE_MAP = { "Today": "today", "Yesterday": "yesterday", "7 Days": "7d", "30 Days": "30d" };

export function RangeProvider({ children }) {
  const [range, setRange] = useState("7d");
  return <RangeContext.Provider value={{ range, setRange, RANGE_MAP }}>{children}</RangeContext.Provider>;
}

export function useRange() { return useContext(RangeContext); }
