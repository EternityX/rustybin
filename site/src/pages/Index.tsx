import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { z } from "zod";

import Layout from "@/components/layout/Layout";
import PasteTextArea from "@/components/paste/PasteTextArea";

import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { extractKeyFromUrl, getPaste, createPaste } from "@/lib/paste";

const Index: React.FC = () => {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [isLoading, setIsLoading] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);

  const { id } = useParams<{ id: string }>();
  const currentPath = useLocation().pathname;

  useEffect(() => {
    // Check for paste success message in localStorage
    const pasteSuccess = localStorage.getItem("pasteSuccess");
    const clipboardSuccess =
      localStorage.getItem("clipboardSuccess") === "true";

    if (pasteSuccess) {
      if (clipboardSuccess) {
        toast.success(
          "paste created! a shareable url was copied to your clipboard"
        );
      } else {
        toast.success("paste created! you are viewing your new paste");
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
        toast.error("no key found in url");
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
          toast.error("no paste found or invalid data");
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

  const handleLanguageChange = (newLanguage: string) => {
    console.log("Changing language to:", newLanguage);
    setLanguage(newLanguage);
  };

  const clearContent = () => {
    setText("");
  };

  const saveContent = async () => {
    if (!text.trim()) {
      toast.error("cannot save an empty paste");
      return;
    }

    const loadingToast = toast.loading("saving paste...");
    setIsLoading(true);

    try {
      const pasteUrl = await createPaste({
        data: text,
        language,
      });

      toast.dismiss(loadingToast);

      if (!pasteUrl) {
        toast.error("failed to create paste");
        return;
      }

      try {
        await navigator.clipboard.writeText(pasteUrl);

        localStorage.setItem("pasteSuccess", "true");
        localStorage.setItem("clipboardSuccess", "true");

        window.location.href = pasteUrl;
      } catch (clipboardError) {
        console.error("Failed to copy to clipboard:", clipboardError);

        localStorage.setItem("pasteSuccess", "true");
        localStorage.setItem("clipboardSuccess", "false");

        window.location.href = pasteUrl;
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error("Error saving paste:", error);

      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors
          .map((err) => `${err.path.join(".")}: ${err.message}`)
          .join(", ");

        toast.error(`validation error: ${errorMessages}`);
      } else if (error instanceof Error) {
        toast.error(`failed to create paste: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

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
