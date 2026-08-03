"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { makeQueryClient } from "@/lib/query-client";

export default function Providers({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Created lazily per-mount so the client is never shared across SSR
  // requests (module-scope singletons are unsafe in the App Router).
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        storageKey="musicflow-theme"
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
}
