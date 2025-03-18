import { useEffect, useState } from "react";

export type Theme = "dark" | "light" | "system";

/**
 * A custom hook to manage theme state with localStorage persistence
 */
export function useThemeManager() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check for theme in localStorage
    if (typeof window !== "undefined") {
      const savedTheme = window.localStorage.getItem("rustybin-theme") as Theme;
      if (savedTheme) {
        return savedTheme;
      }

      // If no theme in localStorage and user prefers dark, use dark
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    }

    // Default to system
    return "system";
  });

  // Update localStorage when theme changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("rustybin-theme", theme);

      // Apply theme to document element
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");

      if (theme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
          .matches
          ? "dark"
          : "light";
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(mediaQuery.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  return {
    theme,
    setTheme,
    isSystem: theme === "system",
    isDark:
      theme === "dark" ||
      (theme === "system" &&
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches),
    isLight:
      theme === "light" ||
      (theme === "system" &&
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches === false),
  };
}
