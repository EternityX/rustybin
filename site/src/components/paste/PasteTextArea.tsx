import React, { useCallback, useEffect, useRef, useState } from "react";
import Editor from "react-simple-code-editor";
import { getPrismLanguage } from "@/utils/language-utils";
import { highlightWithPrism } from "@/utils/prism-utils";
import { usePrismTheme } from "@/utils/prism-theme-utils";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PasteTextAreaProps = {
  text: string;
  setText: (text: string) => void;
  language: string;
  readOnly?: boolean;
  isLoading?: boolean;
  showLineNumbers?: boolean;
  autoFocus?: boolean;
  maxCharacters?: number;
  onLimitExceeded?: (isExceeded: boolean) => void;
};

/**
 * Calculates the byte length of a string in UTF-8 encoding
 * This exactly matches Rust's String.as_bytes().len() behavior
 */
function getUtf8ByteLength(str: string): number {
  // The TextEncoder uses UTF-8 by default
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  return bytes.length;
}

/**
 * Estimate encrypted size after AES encryption and base64 encoding
 * The actual size may vary slightly but this gives a close approximation
 */
function getEstimatedEncryptedSize(byteLength: number): number {
  // AES-GCM adds 16 bytes for the auth tag + 12 bytes for IV
  const encryptedSize = byteLength + 28;
  // Base64 encoding increases size by approximately 4/3
  return Math.ceil(encryptedSize * 1.34);
}

const PasteTextArea: React.FC<PasteTextAreaProps> = ({
  text,
  setText,
  language,
  readOnly = false,
  isLoading = false,
  showLineNumbers = false,
  autoFocus = true,
  maxCharacters = 125000,
  onLimitExceeded,
}) => {
  const { background, textColor, currentTheme } = usePrismTheme();
  const editorRef = useRef<HTMLDivElement>(null);
  const [charStats, setCharStats] = useState({
    lines: 0,
    bytes: 0,
    encryptedBytes: 0,
    remaining: maxCharacters,
  });

  // Determine if we're using a light or dark theme
  const isLightTheme = [
    "prism-coy",
    "prism-funky",
    "prism-solarizedlight",
  ].includes(currentTheme.value);

  // Auto-focus the editor when the component mounts
  useEffect(() => {
    if (autoFocus && editorRef.current && !readOnly && !isLoading) {
      const textarea = editorRef.current.querySelector("textarea");
      if (textarea) {
        setTimeout(() => {
          textarea.focus();
        }, 0);
      }
    }
  }, [autoFocus, readOnly, isLoading]);

  // Ensure styles are applied properly when theme changes
  useEffect(() => {
    if (editorRef.current) {
      // Apply styles directly to ensure they're respected
      const elements = editorRef.current.querySelectorAll(
        "pre, code, textarea"
      );
      elements.forEach((el) => {
        const elem = el as HTMLElement;
        elem.style.backgroundColor = background;
        elem.style.color = textColor;
      });
    }
  }, [background, textColor, currentTheme]);

  // Update character stats whenever text changes
  useEffect(() => {
    const calculateStats = () => {
      if (!text)
        return {
          lines: 0,
          bytes: 0,
          encryptedBytes: 0,
          remaining: maxCharacters,
        };

      // Count lines
      const lines = text.split("\n").length;

      // Get exact byte count using UTF-8 encoding
      const bytes = getUtf8ByteLength(text);

      // Calculate estimated encrypted size
      const encryptedBytes = getEstimatedEncryptedSize(bytes);

      // Calculate remaining space based on encrypted size
      const remaining = maxCharacters - encryptedBytes;

      return {
        lines,
        bytes,
        encryptedBytes,
        remaining,
      };
    };

    const stats = calculateStats();
    setCharStats(stats);

    // Notify parent component if limit is exceeded
    if (onLimitExceeded) {
      onLimitExceeded(stats.remaining < 0);
    }
  }, [text, maxCharacters, onLimitExceeded]);

  const highlightCode = useCallback(
    (code: string) => {
      if (!code) return "";

      try {
        const prismLanguage = getPrismLanguage(language);
        return highlightWithPrism(code, prismLanguage);
      } catch (error) {
        console.error("Error in highlight function:", error);
        return code
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      }
    },
    [language]
  );

  // Generate line numbers if needed
  const renderLineNumbers = () => {
    if (!showLineNumbers || !text) return null;

    const lines = text.split("\n");
    const lineCount = lines.length;

    // Calculate appropriate colors for line numbers
    const lineNumberColor = isLightTheme
      ? `rgba(0, 0, 0, 0.4)` // Dark color with opacity for light themes
      : `rgba(255, 255, 255, 0.4)`; // Light color with opacity for dark themes

    const lineNumberBgColor = isLightTheme
      ? `rgba(0, 0, 0, 0.05)` // Dark bg with opacity for light themes
      : `rgba(255, 255, 255, 0.05)`; // Light bg with opacity for dark themes

    return (
      <div
        className="absolute left-0 top-0 bottom-0 w-12 text-sm pt-[10px] select-none overflow-hidden pointer-events-none z-[1]"
        style={{
          backgroundColor: lineNumberBgColor,
          color: lineNumberColor,
        }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="px-2 text-right h-[21px] leading-[1.5rem]">
            {i + 1}
          </div>
        ))}
      </div>
    );
  };

  const isOverLimit = charStats.remaining < 0;

  return (
    <div className="inset-0 text-card-foreground overflow-hidden flex flex-col">
      <div
        ref={editorRef}
        className="relative flex-grow overflow-auto font-mono"
        style={{ backgroundColor: background }}
      >
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processing...</p>
            </div>
          </div>
        )}
        {renderLineNumbers()}
        <Editor
          value={text}
          onValueChange={readOnly || isLoading ? () => {} : setText}
          highlight={highlightCode}
          disabled={readOnly || isLoading}
          padding={12}
          className="editor-container"
          style={{
            background: `${background} !important`,
            color: `${textColor} !important`,
            transition:
              "background-color 0.2s ease-in-out, color 0.2s ease-in-out",
            fontFamily: "inherit",
            minHeight: "calc(100vh - 2.2rem)",
            marginLeft: showLineNumbers ? "3.5rem" : "0",
          }}
          textareaClassName="outline-none relative z-[2]"
          placeholder={`paste away! your pastes are securely encrypted by your browser before they're saved,\nensuring rustybin can't read them. plus, they last forever.`}
        />

        {/* Character counter */}
        <div className="fixed bottom-2 right-3 text-xs font-mono z-10 select-none flex flex-col gap-1 bg-background/80 px-2 py-1 rounded-md">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              Lines: {charStats.lines}
            </span>
            <span className="mx-1">|</span>
            <span className="text-muted-foreground">
              Raw: {charStats.bytes} bytes
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "transition-colors",
                isOverLimit
                  ? "text-red-500 font-semibold"
                  : "text-muted-foreground"
              )}
            >
              {isOverLimit
                ? `${Math.abs(charStats.remaining)} bytes over limit!`
                : `Encrypted: ${charStats.encryptedBytes}/${maxCharacters} bytes`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasteTextArea;
