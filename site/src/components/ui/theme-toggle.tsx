import React, { useState } from "react";
import { Sun, Moon, Monitor, ChevronDown } from "lucide-react";
import { useThemeManager, type Theme } from "@/lib/use-theme";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useThemeManager();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const themeOptions: Array<{
    value: Theme;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      value: "light",
      label: "Light",
      icon: <Sun className="w-4 h-4" />,
    },
    {
      value: "dark",
      label: "Dark",
      icon: <Moon className="w-4 h-4" />,
    },
    {
      value: "system",
      label: "System",
      icon: <Monitor className="w-4 h-4" />,
    },
  ];

  // Get the current theme option object based on the active theme
  const currentThemeOption =
    themeOptions.find((option) => option.value === theme) || themeOptions[2];

  function handleThemeChange(newTheme: Theme) {
    setTheme(newTheme);
    setDropdownOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-1 bg-secondary rounded text-sm text-foreground font-medium p-1.5 px-3"
        aria-label="Select theme"
      >
        <span className="flex items-center gap-2">
          {currentThemeOption.icon}
          <span className="hidden sm:inline">{currentThemeOption.label}</span>
        </span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-1 w-40 bg-secondary border border-border/5 rounded z-20 shadow-md">
          <ul className="py-1">
            {themeOptions.map((option) => (
              <li key={option.value}>
                <button
                  className={cn(
                    "w-full text-left px-4 py-2 text-sm hover:bg-background text-foreground flex items-center gap-2",
                    theme === option.value && "bg-primary/20"
                  )}
                  onClick={() => handleThemeChange(option.value)}
                >
                  {option.icon}
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
