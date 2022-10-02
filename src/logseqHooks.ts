import "@logseq/libs";
import { useEffect, useState } from "react";

function useThemeMode() {
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");
  useEffect(() => {
    setThemeMode(
      (top!.document.querySelector("html")?.getAttribute("data-theme") as
        | "light"
        | "dark") ??
        (matchMedia("prefers-color-scheme: dark").matches ? "dark" : "light")
    );
    return logseq.App.onThemeModeChanged(({ mode }) => setThemeMode(mode));
  }, []);
  return themeMode;
}

export { useThemeMode };
