import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ListOrdered, Plus, Save, ChevronDown, Loader2 } from "lucide-react";
import {
  languageOptions,
  getPrismLanguage,
  getLanguageLabel,
} from "@/utils/language-utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PrismThemeToggle } from "@/components/ui/prism-theme-toggle";

type MainLayoutProps = {
  children: React.ReactNode;
  language?: string;
  readOnly?: boolean;
  showLanguageSelector?: boolean;
  setLanguage?: (language: string) => void;
  clearContent?: () => void;
  saveContent?: () => void;
  isLoading?: boolean;
  canSave?: boolean;
};

const MainLayout = ({
  children,
  language = "typescript",
  readOnly = false,
  showLanguageSelector = false,
  setLanguage = () => {},
  clearContent = () => {},
  saveContent = () => {},
  isLoading = false,
  canSave = true,
}: MainLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navItems = [
    {
      path: "/",
      icon: isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      ),
      label: isLoading ? "saving..." : "save",
      shortcut: "ctrl+s",
      className: canSave ? "!text-green-400 hover:!text-green-500" : "hidden",
      onClick: () => !isLoading && saveContent(),
      disabled: isLoading || !canSave,
    },
    {
      path: "/",
      icon: <Plus className="h-4 w-4" />,
      label: "new",
      shortcut: "ctrl+o",
      className: "text-nowrap hover:text-foreground/80",
      onClick: () => {
        if (!isLoading) {
          clearContent();
          navigate("/");
        }
      },
      disabled: isLoading,
    },
  ];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-secondary">
        <div className="flex h-8 items-center justify-between px-0 md:px-2">
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="flex items-center gap-1 text-lg font-semibold transition-opacity hover:opacity-80"
            >
              <span className="text-foreground/50 font-extralight tracking-tight sm:flex items-center hidden ">
                {"// "}
                <span className="text-primary text-xl font-semibold ml-1">
                  rusty
                </span>
                <span className="text-xl text-foreground font-semibold">
                  bin
                </span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              {isLoading && (
                <div className="flex items-center text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  <span>Loading...</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-0">
            {showLanguageSelector && (
              <>
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-1 bg-secondary rounded text-sm text-foreground font-medium p-1.5 px-3"
                    disabled={readOnly || isLoading}
                  >
                    {getLanguageLabel(language)}
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {dropdownOpen && !readOnly && !isLoading && (
                    <div className="absolute right-0 mt-1 w-40 bg-secondary border border-border/5 rounded z-20 max-h-[400px] shadow-md overflow-y-auto">
                      <ul className="py-1">
                        {languageOptions.map((option) => (
                          <li key={option.value}>
                            <button
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-background text-foreground ${
                                getPrismLanguage(language) === option.value
                                  ? "bg-primary/40"
                                  : "bg-secondary/20"
                              }`}
                              onClick={() => {
                                setLanguage(option.value);
                                setDropdownOpen(false);
                              }}
                            >
                              {option.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            )}

            <PrismThemeToggle />

            <nav className="flex items-center gap-2">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={`flex items-center gap-2 rounded-md text-sm font-medium transition-colors
                    ${
                      location.pathname === item.path
                        ? "hover:text-primary text-primary-foreground"
                        : "hover:text-primary"
                    } ${item.className} ${
                    item.disabled ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {/* {item.icon} */}
                  <span className="text-xs font-light text-foreground/75 bg-black/20 rounded-[3px] px-1 py-0.5 hidden md:inline -mr-2">
                    {item.shortcut}
                  </span>
                  <span className="inline px-2 py-2">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 animate-fade-in">{children}</main>
    </div>
  );
};

export default MainLayout;
