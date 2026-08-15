"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// Derive the prop types from next-themes itself. The previous hand-written
// interface widened `attribute` to `string`, which does not satisfy the
// library's `Attribute` union.
type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
