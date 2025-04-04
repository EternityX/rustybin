import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { z } from "zod";

import Layout from "@/components/layout/Layout";
import PasteTextArea from "@/components/paste/PasteTextArea";

import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { extractKeyFromUrl, getPaste, createPaste } from "@/lib/paste";

// Debounce utility function that executes immediately then prevents re-execution during wait period
const debounce = <F extends (...args: unknown[]) => unknown>(
  func: F,
  wait: number
): ((...args: Parameters<F>) => void) => {
  let isThrottled = false;

  return function debouncedFunction(...args: Parameters<F>) {
    // If not throttled, execute immediately
    if (!isThrottled) {
      func(...args);
      isThrottled = true;

      // Set a timeout to allow execution again after wait period
      setTimeout(() => {
        isThrottled = false;
      }, wait);
    }
  };
};

const Index: React.FC = () => {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [isLoading, setIsLoading] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const textRef = useRef("");

  const { id } = useParams<{ id: string }>();
  const currentPath = useLocation().pathname;
  const navigate = useNavigate();

  useEffect(() => {
    // Check for paste success message in localStorage
    const pasteSuccess = localStorage.getItem("pasteSuccess");
    const clipboardSuccess =
      localStorage.getItem("clipboardSuccess") === "true";

    if (pasteSuccess) {
      if (clipboardSuccess) {
        toast.success(
          "Paste created! A shareable URL was copied to your clipboard"
        );
      } else {
        toast.success("Paste created! You are viewing your new paste");
      }

      // Clear the success flags after showing the toast
      localStorage.removeItem("pasteSuccess");
      localStorage.removeItem("clipboardSuccess");
    }

    if (currentPath === "/" && text) {
      setText("");
      setIsViewMode(false);
    }

    const fetchPaste = async () => {
      if (currentPath === "/") {
        setIsViewMode(false);
        return;
      }

      setIsLoading(true);

      console.log("Fetching paste for path:", currentPath);
      console.log("Paste ID from params:", id);

      if (!id) {
        toast.error("Invalid paste ID");
        setIsLoading(false);
        return;
      }

      const key = extractKeyFromUrl();
      console.log("Extracted key exists:", !!key);

      if (!key) {
        toast.error("No key found in URL");
        setIsLoading(false);
        return;
      }

      // Set view mode to true when we have a key in the URL
      setIsViewMode(true);

      try {
        console.log("Attempting to get paste with ID:", id);
        const paste = await getPaste(id, key);

        if (!paste) {
          console.log("No paste returned from getPaste");
          toast.error("No paste found or invalid data");
          setIsLoading(false);
          return;
        }

        console.log(
          "Paste retrieved successfully, data length:",
          paste.data.length
        );
        console.log("Paste language:", paste.language);

        setText(paste.data);
        setLanguage(paste.language || "javascript");
      } catch (error) {
        console.error("Error fetching paste:", error);

        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
          const errorMessages = error.errors
            .map((err) => `${err.path.join(".")}: ${err.message}`)
            .join(", ");
          toast.error(`Validation error: ${errorMessages}`);
        } else {
          toast.error(
            "Failed to decrypt paste. The URL may be invalid or corrupted."
          );
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchPaste();
  }, [currentPath, id]);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const handleLanguageChange = (newLanguage: string) => {
    console.log("Changing language to:", newLanguage);
    setLanguage(newLanguage);
  };

  const clearContent = useCallback(() => {
    setText("");
  }, [setText]);

  const saveContent = useCallback(async () => {
    if (!textRef.current.trim()) {
      toast.error("Cannot save an empty paste");
      return;
    }

    if (id) {
      toast.error("Cannot save a paste that already exists");
      return;
    }

    const loadingToast = toast.loading("saving paste...");
    setIsLoading(true);

    try {
      const pasteUrl = await createPaste({
        data: textRef.current,
        language,
      });

      toast.dismiss(loadingToast);

      if (!pasteUrl) {
        toast.error("Failed to create paste");
        return;
      }

      // Extract the path from the URL (in case it's a full URL)
      const getPathFromUrl = (url: string) => {
        try {
          const urlObj = new URL(url);
          return urlObj.pathname + urlObj.search + urlObj.hash;
        } catch (e) {
          // If it's not a valid URL with protocol, assume it's already a path
          return url;
        }
      };

      const pastePath = getPathFromUrl(pasteUrl);

      // Construct the absolute URL for clipboard
      const getAbsoluteUrl = (relativePath: string) => {
        const origin = window.location.origin;
        // Make sure we don't double-slash
        const cleanPath = relativePath.startsWith("/")
          ? relativePath.substring(1)
          : relativePath;
        return `${origin}/${cleanPath}`;
      };

      // Ensure the relative path doesn't have domain info
      const cleanPath = pastePath.startsWith("http")
        ? getPathFromUrl(pastePath)
        : pastePath;

      // Get the full absolute URL for the clipboard
      const absoluteUrl = getAbsoluteUrl(cleanPath);

      try {
        // Copy the full absolute URL to clipboard
        await navigator.clipboard.writeText(absoluteUrl);

        localStorage.setItem("pasteSuccess", "true");
        localStorage.setItem("clipboardSuccess", "true");

        // Navigate to just the path portion
        navigate(pastePath);
      } catch (clipboardError) {
        console.error("Failed to copy to clipboard:", clipboardError);

        localStorage.setItem("pasteSuccess", "true");
        localStorage.setItem("clipboardSuccess", "false");

        navigate(pastePath);
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error("Error saving paste:", error);

      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors
          .map((err) => `${err.path.join(".")}: ${err.message}`)
          .join(", ");

        toast.error(`Validation error: ${errorMessages}`);
      } else if (error instanceof Error) {
        toast.error(`Failed to create paste: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [textRef, language, setIsLoading, navigate]);

  useEffect(() => {
    const saveContentDebounced = debounce(() => {
      if (currentPath !== "/") {
        return;
      }

      if (!textRef.current.trim()) {
        toast.error("Cannot save an empty paste");
        return;
      }
      saveContent();
    }, 1000);

    const clearContentDebounced = debounce(() => {
      setText("");
      navigate("/");
    }, 100);

    const down = (e: KeyboardEvent) => {
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        saveContentDebounced();
      }

      if (e.key === "o" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        clearContentDebounced();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [saveContent, clearContent, navigate]);

  return (
    <Layout
      language={language}
      setLanguage={handleLanguageChange}
      showLanguageSelector={true}
      clearContent={clearContent}
      saveContent={saveContent}
      isLoading={isLoading}
      canSave={!isViewMode}
    >
      <PasteTextArea
        text={text}
        setText={setText}
        language={language}
        isLoading={isLoading}
        readOnly={isViewMode}
        showLineNumbers={isViewMode}
      />
    </Layout>
  );
};

export default Index;
