import { createContext, useContext } from "react";

export const SidebarCompactContext = createContext(false);
export const useSidebarCompact = () => useContext(SidebarCompactContext);
