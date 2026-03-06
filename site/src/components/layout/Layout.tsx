import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Plus,
  Save,
  Loader2,
  Trash2,
  Flame,
  Clock,
  ShieldCheck,
  FileText,
  Lock,
  ScanEye,
  Eye,
} from "lucide-react";
import SecurityInfo from "@/components/paste/SecurityInfo";
import { languageOptions, getLanguageLabel } from "@/utils/language-utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Terms from "../paste/Terms";
import Privacy from "../paste/Privacy";

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
  advancedMode?: boolean;
  onAdvancedModeChange?: (value: boolean) => void;
  showAdvancedToggle?: boolean;
  burnAfterRead?: boolean;
  onBurnAfterReadChange?: (value: boolean) => void;
  expiresInMinutes?: number | null;
  onExpiresInMinutesChange?: (value: number | null) => void;
  canDelete?: boolean;
  onDelete?: () => void;
  byteCount?: number;
  maxBytes?: number;
  isOverLimit?: boolean;
  showByteCounter?: boolean;
};

const EXPIRATION_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "5", label: "5 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "240", label: "4 hours" },
  { value: "720", label: "12 hours" },
  { value: "1440", label: "24 hours" },
  { value: "4320", label: "3 days" },
  { value: "10080", label: "1 week" },
];

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
  advancedMode = false,
  onAdvancedModeChange = () => {},
  showAdvancedToggle = false,
  burnAfterRead = false,
  onBurnAfterReadChange = () => {},
  expiresInMinutes = null,
  onExpiresInMinutesChange = () => {},
  canDelete = false,
  onDelete = () => {},
  byteCount = 0,
  maxBytes = 125000,
  isOverLimit = false,
  showByteCounter = false,
}: MainLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [securityOpen, setSecurityOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const navItems = [
    {
      path: "/",
      icon: <Plus className="h-4 w-4" />,
      label: "new",
      shortcut: "ctrl+o",
      className: "text-nowrap",
      onClick: () => {
        if (!isLoading) {
          clearContent();
          navigate("/");
        }
      },
      disabled: isLoading,
    },
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
      icon: <Trash2 className="h-4 w-4" />,
      label: "delete",
      className: canDelete
        ? "border-l border-white/10 ml-[2px] rounded-none !text-red-400 hover:!text-red-500"
        : "hidden",
      onClick: () => !isLoading && onDelete(),
      disabled: isLoading || !canDelete,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-[#0F0F0F]">
        <div className="flex min-h-[35px] flex-col sm:flex-row sm:items-center sm:justify-between px-2 -mt-1 py-1 sm:py-0 sm:mt-0 gap-y-1">
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <Link
              to="/"
              className="items-center gap-1 text-lg font-semibold transition-opacity hidden md:flex"
            >
              <span className="group text-[14px] uppercase tracking-wider font-bold text-primary hover:text-white transition-colors">
                <span className="">
                  rusty
                </span>
                <span className="text-[14px] uppercase tracking-wider font-bold text-white group-hover:text-white/50 transition-colors">
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

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
            {showAdvancedToggle && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center mr-2">
                    <Label
                      htmlFor="advanced-mode"
                      className="text-white cursor-pointer flex items-center mr-3 text-sm text-foreground font-medium"
                    >
                      <span className="inline text-[10px] uppercase tracking-wider font-bold text-white hover:text-primary transition-colors">
                        advanced
                      </span>
                    </Label>
                    <Switch
                      id="advanced-mode"
                      checked={advancedMode}
                      onCheckedChange={onAdvancedModeChange}
                      className="h-[21px]"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="rounded-none border border-white/10 hover:border-primary/50 bg-black/20 backdrop-blur-sm text-white text-[10px] uppercase tracking-wider font-bold text-white/50 hover:text-primary transition-colors">
                  <p>Enable advanced options when saving a paste</p>
                </TooltipContent>
              </Tooltip>
            )}

            {showAdvancedToggle && advancedMode && (
              <div className="flex items-center gap-2 sm:border-l  border-white/10 sm:pl-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      <Flame
                        className={`h-3.5 w-3.5 ${burnAfterRead ? "text-orange-400" : "text-white/50"}`}
                      />
                      <Switch
                        id="burn-after-read"
                        checked={burnAfterRead}
                        onCheckedChange={onBurnAfterReadChange}
                        className="h-[21px]"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-none border border-white/10 hover:border-primary/50 bg-black/20 backdrop-blur-sm text-white text-[10px] uppercase tracking-wider font-bold text-white/50 hover:text-primary transition-colors">
                    <p>Burn after read</p>
                  </TooltipContent>
                </Tooltip>

                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Clock
                        className={`h-3.5 w-3.5 ${expiresInMinutes ? "text-blue-400" : "text-white/50"}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent className="rounded-none border border-white/10 hover:border-primary/50 bg-black/20 backdrop-blur-sm text-white text-[10px] uppercase tracking-wider font-bold text-white/50 hover:text-primary transition-colors">
                      <p>Delete after</p>
                    </TooltipContent>
                  </Tooltip>
                  <Select
                    value={expiresInMinutes?.toString() || "never"}
                    onValueChange={(value) =>
                      onExpiresInMinutesChange(
                        value === "never" ? null : parseInt(value),
                      )
                    }
                  >
                    <SelectTrigger className="h-[21px] w-[90px] text-[10px] uppercase tracking-wider font-bold bg-[#0A0A0A]/0 border-[#222222] rounded-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0A0A0A] border-[#222222] rounded-none">
                      {EXPIRATION_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="text-[10px] uppercase tracking-wider font-bold"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {showLanguageSelector && (
              <Select
                value={language}
                onValueChange={setLanguage}
                disabled={readOnly || isLoading}
              >
                <SelectTrigger className="h-[21px] w-[120px] text-[10px] uppercase tracking-wider font-bold bg-[#0A0A0A]/0 border-[#222222] rounded-none mr-1">
                  <SelectValue>{getLanguageLabel(language)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-[#0A0A0A] border-[#222222] rounded-none max-h-[400px]">
                  {languageOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="text-[10px] uppercase tracking-wider font-bold"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <nav className="flex items-center gap-1.5">
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
                  {item.shortcut && (
                    <span className="text-xs text-foreground/75 bg-[#0A0A0A]/0 border border-[#222222] px-1 py-[1.5px] font-mono hidden md:inline -mr-2">
                      {item.shortcut}
                    </span>
                  )}
                  <span className="inline px-[8px] py-2 text-[10px] uppercase tracking-wider font-bold hover:text-primary transition-colors">
                    {item.label}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 animate-fade-in">{children}</main>

      <footer className="sticky bottom-0 z-50 border-t border-white/10 bg-[#0F0F0F]">
        <div className="flex min-h-[30px] items-center px-2 py-1">
          <SecurityInfo
            open={securityOpen}
            onOpenChange={setSecurityOpen}
            trigger={
              <button className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-white/30 hover:text-primary transition-colors">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="inline">Security Overview</span>
              </button>
            }
          />

          <Terms
            open={termsOpen}
            onOpenChange={setTermsOpen}
            trigger={
              <button className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-white/30 hover:text-primary transition-colors">
                <FileText className="h-3.5 w-3.5" />
                <span className="inline">Terms of Service</span>
              </button>
            }
          />

          <Privacy
            open={privacyOpen}
            onOpenChange={setPrivacyOpen}
            trigger={
              <button className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-white/30 hover:text-primary transition-colors">
                <Eye className="h-3.5 w-3.5" />
                <span className="inline">Privacy Policy</span>
              </button>
            }
          />

          {showByteCounter && (
            <div className="items-center ml-auto gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-white/30 hidden sm:flex">
              <span
                className={
                  isOverLimit ? "text-red-500 font-semibold" : "text-white/30"
                }
              >
                {isOverLimit
                  ? `${Math.abs((byteCount || 0) - (maxBytes || 0))} bytes over limit!`
                  : `${byteCount || 0}/${maxBytes || 0} bytes`}
              </span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
