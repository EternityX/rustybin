import { useEffect, useState } from "react";

// List of available Prism themes with their associated background colors
// Extended with themes from https://github.com/PrismJS/prism-themes
export const prismThemes = [
  // Default Prism themes
  {
    value: "prism-tomorrow",
    label: "Tomorrow Night",
    background: "#2d2d2d",
    textColor: "#fdfdfd",
    source: "default",
  },
  {
    value: "prism-coy",
    label: "Coy",
    background: "#fdfdfd",
    textColor: "#2d2d2d",
    source: "default",
  },
  {
    value: "prism-okaidia",
    label: "Okaidia",
    background: "#272822",
    textColor: "#fdfdfd",
    source: "default",
  },
  {
    value: "prism-solarizedlight",
    label: "Solarized Light",
    background: "#fdf6e3",
    textColor: "#2d2d2d",
    source: "default",
  },
  {
    value: "prism-twilight",
    label: "Twilight",
    background: "#141414",
    textColor: "#fdfdfd",
    source: "default",
  },

  // Extended themes from prism-themes repository
  {
    value: "prism-a11y-dark",
    label: "a11y Dark",
    background: "#2b2b2b",
    textColor: "#f8f8f2",
    source: "extra",
  },
  {
    value: "prism-atom-dark",
    label: "Atom Dark",
    background: "#1d1f21",
    textColor: "#c5c8c6",
    source: "extra",
  },
  {
    value: "prism-coldark-cold",
    label: "Coldark Cold",
    background: "#FFFFFF",
    textColor: "#111b27",
    source: "extra",
  },
  {
    value: "prism-coldark-dark",
    label: "Coldark Dark",
    background: "#111b27",
    textColor: "#e3eaf2",
    source: "extra",
  },
  {
    value: "prism-dracula",
    label: "Dracula",
    background: "#282a36",
    textColor: "#f8f8f2",
    source: "extra",
  },
  {
    value: "prism-ghcolors",
    label: "GH Colors",
    background: "#fff",
    textColor: "#333",
    source: "extra",
  },
  {
    value: "prism-gruvbox-light",
    label: "Gruvbox Light",
    background: "#fbf1c7",
    textColor: "#3c3836",
    source: "extra",
  },
  {
    value: "prism-holi-theme",
    label: "Holi Theme",
    background: "#121212",
    textColor: "#d6e7ff",
    source: "extra",
  },
  {
    value: "prism-laserwave",
    label: "Laserwave",
    background: "#27212e",
    textColor: "#ffffff",
    source: "extra",
  },
  {
    value: "prism-lucario",
    label: "Lucario",
    background: "#2b3e50",
    textColor: "#f8f8f2",
    source: "extra",
  },
  {
    value: "prism-material-dark",
    label: "Material Dark",
    background: "#2f2f2f",
    textColor: "#eeffff",
    source: "extra",
  },
  {
    value: "prism-material-light",
    label: "Material Light",
    background: "#fafafa",
    textColor: "#90a4ae",
    source: "extra",
  },
  {
    value: "prism-material-oceanic",
    label: "Material Oceanic",
    background: "#263238",
    textColor: "#c3cee3",
    source: "extra",
  },
  {
    value: "prism-night-owl",
    label: "Night Owl",
    background: "#011627",
    textColor: "#d6deeb",
    source: "extra",
  },
  {
    value: "prism-nord",
    label: "Nord",
    background: "#2e3440",
    textColor: "#f8f8f2",
    source: "extra",
  },
  {
    value: "prism-one-dark",
    label: "One Dark",
    background: "#282c34",
    textColor: "#abb2bf",
    source: "extra",
  },
  {
    value: "prism-one-light",
    label: "One Light",
    background: "#fafafa",
    textColor: "#383a42",
    source: "extra",
  },
  {
    value: "prism-pojoaque",
    label: "Pojoaque",
    background: "#181914",
    textColor: "#dccf8f",
    source: "extra",
  },
  {
    value: "prism-synthwave84",
    label: "Synthwave '84",
    background: "#2b213a",
    textColor: "#f92aad",
    source: "extra",
  },
  {
    value: "prism-vs",
    label: "VS",
    background: "#fff",
    textColor: "#393a34",
    source: "extra",
  },
  {
    value: "prism-z-touch",
    label: "Z-Touch",
    background: "#0a0a0a",
    textColor: "#fff",
    source: "extra",
  },
] as const;

export type PrismTheme = (typeof prismThemes)[number]["value"];

// Local storage key for the theme
const STORAGE_KEY = "rustybin-prism-theme";

// Get the theme from localStorage or use default
export function getStoredPrismTheme(): PrismTheme {
  if (typeof window === "undefined") return "prism-tomorrow";

  const storedTheme = window.localStorage.getItem(
    STORAGE_KEY
  ) as PrismTheme | null;
  return storedTheme || "prism-tomorrow";
}

// Save theme to localStorage
export function savePrismTheme(theme: PrismTheme): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, theme);
}

// Get the background color for a specific theme
export function getThemeBackground(theme: PrismTheme): string {
  const themeObj = prismThemes.find((t) => t.value === theme);
  return themeObj ? themeObj.background : "#2d2d2d"; // Default to Tomorrow Night bg
}

// Load the theme's CSS dynamically
export function loadPrismTheme(theme: PrismTheme): void {
  if (typeof document === "undefined") return;

  // Create or get the theme style element
  let styleElement = document.getElementById("prism-theme-style");
  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = "prism-theme-style";
    document.head.appendChild(styleElement);
  }

  // Save the theme name as a data attribute on the body
  document.body.dataset.prismTheme = theme;

  // Get theme colors
  const themeObj = prismThemes.find((t) => t.value === theme);
  if (themeObj) {
    // Set CSS variables that can be used throughout the app
    document.documentElement.style.setProperty(
      "--prism-bg",
      themeObj.background
    );

    // Set text color
    document.documentElement.style.setProperty(
      "--prism-text-color",
      themeObj.textColor
    );

    // Force all editor containers to use these colors
    setTimeout(() => {
      // Using setTimeout to ensure elements are ready and to run after the current execution context
      const editors = document.querySelectorAll(".editor-container");
      editors.forEach((editor) => {
        const editorEl = editor as HTMLElement;
        editorEl.style.backgroundColor = themeObj.background;
        editorEl.style.color = themeObj.textColor;

        // Also apply to child elements that might need the color
        const textElements = editorEl.querySelectorAll("pre, code, textarea");
        textElements.forEach((el) => {
          const elem = el as HTMLElement;
          elem.style.backgroundColor = "transparent";
          elem.style.color = themeObj.textColor;
        });
      });
    }, 0);
  }

  // Determine the URL based on the theme source
  const themeWithoutPrefix = theme.replace("prism-", "");
  const isDefaultTheme = themeObj?.source === "default";

  // Default Prism themes are available directly from the prismjs package
  // Extended themes are from the prism-themes package on CDN
  const themeUrl = isDefaultTheme
    ? `https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-${themeWithoutPrefix}.min.css`
    : `https://cdn.jsdelivr.net/npm/prism-themes@1.9.0/themes/prism-${themeWithoutPrefix}.min.css`;

  fetch(themeUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load theme: ${response.statusText}`);
      }
      return response.text();
    })
    .then((css) => {
      // Replace any background declarations with our variable
      const modifiedCss = css
        // Keep the token colors but remove backgrounds
        .replace(/background(-color)?:\s*[^;]+;/g, "background: transparent;")
        // Remove box-shadows and borders that might conflict
        .replace(/box-shadow:[^;]+;/g, "box-shadow: none !important;")
        .replace(/border(-\w+)?:[^;]+;/g, "");

      styleElement.textContent = modifiedCss;
    })
    .catch((err) => {
      console.error(`Failed to load theme ${theme}:`, err);

      // Fall back to a default theme if loading fails
      if (theme !== "prism-tomorrow") {
        console.log("Falling back to default theme");
        setTheme("prism-tomorrow");
      }
    });
}

// A hook for managing the Prism theme
export function usePrismTheme() {
  const [theme, setTheme] = useState<PrismTheme>(getStoredPrismTheme);

  // Apply the theme when it changes
  useEffect(() => {
    savePrismTheme(theme);
    loadPrismTheme(theme);
  }, [theme]);

  // Get the current theme object
  const currentTheme =
    prismThemes.find((t) => t.value === theme) || prismThemes[0];

  return {
    theme,
    setTheme,
    prismThemes,
    currentTheme,
    background: currentTheme.background,
    textColor: currentTheme.textColor,
  };
}

// Helper function for safely setting a theme
export function setTheme(theme: PrismTheme): void {
  const themeExists = prismThemes.some((t) => t.value === theme);
  if (themeExists) {
    savePrismTheme(theme);
    loadPrismTheme(theme);
  } else {
    console.error(`Theme ${theme} not found, using default`);
    savePrismTheme("prism-tomorrow");
    loadPrismTheme("prism-tomorrow");
  }
}
