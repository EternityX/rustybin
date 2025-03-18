import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Code, Search } from "lucide-react";
import { usePrismTheme, type PrismTheme } from "@/utils/prism-theme-utils";
import { cn } from "@/lib/utils";

export function PrismThemeToggle() {
  const { theme, setTheme, prismThemes } = usePrismTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get the current theme option object based on the active theme
  const currentTheme =
    prismThemes.find((option) => option.value === theme) || prismThemes[0];

  // Group themes by light/dark
  const groupedThemes = useMemo(() => {
    // Identify light themes based on background color
    const isLightTheme = (bgColor: string) => {
      // Convert hex to RGB and calculate luminance
      const hex = bgColor.replace("#", "");
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return luminance > 0.5; // Luminance > 0.5 is considered light
    };

    // Filter themes that match the search query
    const filteredThemes = searchQuery
      ? prismThemes.filter((t) =>
          t.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : prismThemes;

    return {
      dark: filteredThemes.filter((t) => !isLightTheme(t.background)),
      light: filteredThemes.filter((t) => isLightTheme(t.background)),
    };
  }, [prismThemes, searchQuery]);

  function handleThemeChange(newTheme: PrismTheme) {
    setTheme(newTheme);
    setDropdownOpen(false);
    setSearchQuery("");
  }

  // Focus search input when dropdown opens
  useEffect(() => {
    if (dropdownOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 10);
    }
  }, [dropdownOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
        setSearchQuery("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // This CSS creates a color swatch with a double-color display
  const getSwatchStyle = (bgColor: string, textColor: string) => ({
    background: bgColor,
    boxShadow: `inset -8px 0 0 0 ${textColor}`,
    border: "1px solid rgba(127, 127, 127, 0.2)",
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-1 bg-secondary rounded text-sm text-foreground font-medium p-1.5 px-3"
        aria-label="Select syntax theme"
      >
        <span className="flex items-center gap-2">
          <span className="hidden sm:inline">
            <span
              className="inline-block w-3 h-3 rounded-full mr-1 align-middle"
              style={getSwatchStyle(
                currentTheme.background,
                currentTheme.textColor
              )}
            />
            {currentTheme.label.toLowerCase()}
          </span>
          <span className="sm:hidden">Syntax</span>
        </span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-1 w-64 bg-secondary border border-border/5 rounded z-20 shadow-md">
          <div className="p-2 border-b border-border/10">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="search themes..."
                className="w-full py-1.5 pl-8 pr-2 text-sm bg-background rounded border border-border/10 focus:outline-none focus:ring-1 focus:ring-primary"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {/* Dark Themes */}
            {groupedThemes.dark.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-secondary/50">
                  dark themes ({groupedThemes.dark.length})
                </div>
                <ul className="py-1">
                  {groupedThemes.dark.map((option) => (
                    <li key={option.value}>
                      <button
                        className={cn(
                          "w-full text-left px-4 py-2 text-sm hover:bg-background text-foreground flex items-center gap-2",
                          theme === option.value && "bg-primary/20"
                        )}
                        onClick={() => handleThemeChange(option.value)}
                      >
                        <span
                          className="inline-block w-4 h-4 rounded-full flex-shrink-0"
                          style={getSwatchStyle(
                            option.background,
                            option.textColor
                          )}
                          title={`${option.label}: ${option.background} / ${option.textColor}`}
                        />
                        <span className="truncate">
                          {option.label.toLowerCase()}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Light Themes */}
            {groupedThemes.light.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-secondary/50">
                  light themes ({groupedThemes.light.length})
                </div>
                <ul className="py-1">
                  {groupedThemes.light.map((option) => (
                    <li key={option.value}>
                      <button
                        className={cn(
                          "w-full text-left px-4 py-2 text-sm hover:bg-background text-foreground flex items-center gap-2",
                          theme === option.value && "bg-primary/20"
                        )}
                        onClick={() => handleThemeChange(option.value)}
                      >
                        <span
                          className="inline-block w-4 h-4 rounded-full flex-shrink-0"
                          style={getSwatchStyle(
                            option.background,
                            option.textColor
                          )}
                          title={`${option.label}: ${option.background} / ${option.textColor}`}
                        />
                        <span className="truncate">
                          {option.label.toLowerCase()}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* No results */}
            {groupedThemes.dark.length === 0 &&
              groupedThemes.light.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No matching themes found
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
