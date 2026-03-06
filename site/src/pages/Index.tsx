import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";

import Layout from "@/components/layout/Layout";
import PasteTextArea, { type ByteStats } from "@/components/paste/PasteTextArea";
import { detectLanguage } from "@/lib/language-detector";
import { debounce } from "@/lib/debounce";
import type { ShareDialogData } from "@/lib/types";

import { toast } from "sonner";
import {
  extractKeyFromUrl,
  getPaste,
  createPaste,
  updatePaste,
  deletePaste,
  PasteError,
  KeyInfo,
} from "@/lib/paste";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Flame, Clock } from "lucide-react";


const Index: React.FC = () => {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [isLoading, setIsLoading] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [expiresInMinutes, setExpiresInMinutes] = useState<number | null>(null);
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareData, setShareData] = useState<ShareDialogData | null>(null);
  const [copiedView, setCopiedView] = useState(false);
  const [copiedEdit, setCopiedEdit] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [byteStats, setByteStats] = useState<ByteStats>({
    lines: 0,
    bytes: 0,
    encryptedBytes: 0,
    remaining: 125000,
  });
  const textRef = useRef("");

  const { id } = useParams<{ id: string }>();
  const currentPath = useLocation().pathname;
  const navigate = useNavigate();

  // Handle paste success messages from localStorage
  useEffect(() => {
    const pasteSuccess = localStorage.getItem("pasteSuccess");
    const clipboardSuccess = localStorage.getItem("clipboardSuccess") === "true";

    if (pasteSuccess && !localStorage.getItem("showShareDialog")) {
      if (clipboardSuccess) {
        toast.success("Paste created! A shareable URL was copied to your clipboard");
      } else {
        toast.success("Paste created! You are viewing your new paste");
      }
    }
    
    localStorage.removeItem("pasteSuccess");
    localStorage.removeItem("clipboardSuccess");
    localStorage.removeItem("showShareDialog");
  }, [currentPath]);

  // Fetch paste when navigating to a paste URL
  useEffect(() => {
    if (currentPath === "/") {
      setText("");
      setIsViewMode(false);
      setCanEdit(false);
      setKeyInfo(null);
      return;
    }

    const fetchPaste = async () => {
      if (!id) {
        toast.error("Invalid paste ID");
        return;
      }

      setIsLoading(true);

      const keys = extractKeyFromUrl();

      if (!keys) {
        toast.error("No decryption key found in URL. Make sure to use the full link.");
        setIsLoading(false);
        return;
      }

      setKeyInfo(keys);
      setIsViewMode(true);
      setCanEdit(!!keys.editKey);

      try {
        const paste = await getPaste(id, keys.encryptionKey);
        setText(paste.data);
        setLanguage(paste.language || "javascript");
      } catch (error) {
        if (error instanceof PasteError) {
          switch (error.code) {
            case "NOT_FOUND":
              toast.error("Paste not found. It may have been deleted.");
              break;
            case "INVALID_KEY":
              toast.error("Invalid decryption key format.");
              break;
            case "DECRYPTION_FAILED":
              toast.error("Failed to decrypt. The key may be incorrect or the data is corrupted.");
              break;
            default:
              toast.error(`Error: ${error.message}`);
          }
        } else {
          toast.error("Failed to load paste. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaste();
  }, [currentPath, id]);

  // Keep textRef in sync with text
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  // Auto-detect language while typing (only for new pastes)
  useEffect(() => {
    // Only auto-detect when creating a new paste, not when viewing
    if (currentPath !== "/" || isViewMode) {
      return;
    }

    // Don't detect if text is too short (need enough content for accurate detection)
    if (text.length < 20) {
      return;
    }

    // Debounce the detection to run ~1 second after user stops typing
    const timeoutId = setTimeout(() => {
      const detected = detectLanguage(text);
      // If detection returns something valid (not "unknown"), use it
      // Otherwise fallback to javascript
      const newLanguage = detected !== "unknown" ? detected : "javascript";
      
      // Only update if the language actually changed
      if (newLanguage !== language) {
        setLanguage(newLanguage);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [text, currentPath, isViewMode, language]);

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
  };

  const clearContent = useCallback(() => {
    setText("");
    setAdvancedMode(false);
    setBurnAfterRead(false);
    setExpiresInMinutes(null);
  }, []);

  const copyToClipboard = async (text: string, type: 'view' | 'edit') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'view') {
        setCopiedView(true);
        setTimeout(() => setCopiedView(false), 2000);
      } else {
        setCopiedEdit(true);
        setTimeout(() => setCopiedEdit(false), 2000);
      }
      return true;
    } catch {
      return false;
    }
  };

  const saveContent = useCallback(async () => {
    const content = textRef.current.trim();

    if (!content) {
      toast.error("Cannot save an empty paste");
      return;
    }

    // If we're in edit mode (have an ID and edit key), update the paste
    if (id && keyInfo?.editKey) {
      const loadingToast = toast.loading("Updating paste...");
      setIsLoading(true);

      try {
        await updatePaste(id, { data: content, language }, keyInfo.encryptionKey, keyInfo.editKey);
        toast.dismiss(loadingToast);
        toast.success("Paste updated successfully!");
      } catch (error) {
        toast.dismiss(loadingToast);
        if (error instanceof PasteError) {
          toast.error(error.message);
        } else {
          toast.error("Failed to update paste");
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // If we have an ID but no edit key, can't save
    if (id) {
      toast.error("Cannot save a paste that already exists");
      return;
    }

    // Create new paste
    const loadingToast = toast.loading("Saving paste...");
    setIsLoading(true);

    try {
      const result = await createPaste(
        { data: content, language },
        {
          includeEditKey: advancedMode,
          burnAfterRead: advancedMode ? burnAfterRead : false,
          expiresInMinutes: advancedMode ? expiresInMinutes : null,
        }
      );

      toast.dismiss(loadingToast);

      if (!result) {
        toast.error("Failed to create paste");
        return;
      }

      // Build URLs
      const origin = window.location.origin;
      
      // Parse the result URL to extract parts
      const [pasteIdWithKey] = result.url.split('#');
      const hashPart = result.url.includes('#') ? result.url.split('#')[1] : '';
      
      // Extract encryption key (before colon) and edit key (after colon)
      const [encryptionKey, editKey] = hashPart.split(':');
      
      // Build view-only URL (just encryption key)
      const viewOnlyUrl = `${origin}/${pasteIdWithKey}#${encryptionKey}`;
      
      // Build editable URL (full URL with edit key)
      const editableUrl = editKey ? `${origin}/${result.url}` : viewOnlyUrl;

      // If editing was enabled, show the dialog
      if (advancedMode) {
        setShareData({
          viewOnlyUrl,
          editableUrl,
          burnAfterRead,
          expiresInMinutes,
        });
        setShareDialogOpen(true);
        
        // Copy view-only URL by default
        await navigator.clipboard.writeText(viewOnlyUrl).catch(() => {});
        
        // If burn-after-read is enabled, DON'T navigate to the paste
        // This would consume the one-time view before the user can share it
        if (burnAfterRead) {
          toast.success("Paste created! URL copied to clipboard. Share it - the paste will be deleted after first view.");
          // Clear the editor for a fresh start
          setText("");
          setAdvancedMode(false);
          setBurnAfterRead(false);
          setExpiresInMinutes(null);
        } else {
          // Navigate to the editable URL (so user can still edit)
          const pastePath = "/" + result.url;
          navigate(pastePath);
        }
      } else {
        // No edit key, just copy and navigate
        const pastePath = "/" + result.url;
        const absoluteUrl = `${origin}${pastePath}`;

        try {
          await navigator.clipboard.writeText(absoluteUrl);
          localStorage.setItem("pasteSuccess", "true");
          localStorage.setItem("clipboardSuccess", "true");
        } catch {
          localStorage.setItem("pasteSuccess", "true");
          localStorage.setItem("clipboardSuccess", "false");
        }

        navigate(pastePath);
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      if (error instanceof PasteError) {
        toast.error(error.message);
      } else if (error instanceof Error) {
        toast.error(`Failed to create paste: ${error.message}`);
      } else {
        toast.error("Failed to create paste");
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, keyInfo, language, navigate, advancedMode, burnAfterRead, expiresInMinutes]);

  const deleteContent = useCallback(async () => {
    if (!id || !keyInfo?.editKey) {
      toast.error("Cannot delete this paste");
      return;
    }

    const loadingToast = toast.loading("Deleting paste...");
    setIsLoading(true);

    try {
      await deletePaste(id, keyInfo.editKey);
      toast.dismiss(loadingToast);
      toast.success("Paste deleted successfully!");
      setDeleteDialogOpen(false);
      navigate("/");
    } catch (error) {
      toast.dismiss(loadingToast);
      if (error instanceof PasteError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to delete paste");
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, keyInfo, navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    const saveContentDebounced = debounce(() => {
      if (currentPath !== "/" && !canEdit) return;
      if (!textRef.current.trim()) {
        toast.error("Cannot save an empty paste");
        return;
      }
      saveContent();
    }, 1000);

    const clearContentDebounced = debounce(() => {
      setAdvancedMode(false);
      setBurnAfterRead(false);
      setExpiresInMinutes(null);
      navigate("/");
    }, 100);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        saveContentDebounced();
      }

      if (e.key === "o" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        clearContentDebounced();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [saveContent, clearContent, navigate, currentPath, canEdit]);

  // Determine if we should show save button (new paste or editable existing paste)
  const showSaveButton = !isViewMode || canEdit;
  
  // Only show advanced toggle when creating a new paste (not viewing)
  const showAdvancedToggle = currentPath === "/" && !isViewMode;

  return (
    <>
      <Layout
        language={language}
        setLanguage={handleLanguageChange}
        showLanguageSelector={true}
        clearContent={clearContent}
        saveContent={saveContent}
        isLoading={isLoading}
        canSave={showSaveButton}
        advancedMode={advancedMode}
        onAdvancedModeChange={setAdvancedMode}
        showAdvancedToggle={showAdvancedToggle}
        burnAfterRead={burnAfterRead}
        onBurnAfterReadChange={setBurnAfterRead}
        expiresInMinutes={expiresInMinutes}
        onExpiresInMinutesChange={setExpiresInMinutes}
        canDelete={canEdit}
        onDelete={() => setDeleteDialogOpen(true)}
        byteCount={byteStats.encryptedBytes}
        maxBytes={125000}
        isOverLimit={byteStats.remaining < 0}
        showByteCounter={true}
      >
        <PasteTextArea
          text={text}
          setText={setText}
          language={language}
          isLoading={isLoading}
          readOnly={isViewMode && !canEdit}
          showLineNumbers={isViewMode}
          onByteStatsChange={setByteStats}
        />
      </Layout>


      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0A0A0A] border-[1px] border-[#222222] rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Paste created with advanced options
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Choose a URL to share.
            </DialogDescription>
          </DialogHeader>

          {(shareData?.burnAfterRead || shareData?.expiresInMinutes) && (
            <div className="flex flex-wrap gap-2 pb-2">
              {shareData?.burnAfterRead && (
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs bg-orange-500/10 border border-orange-500/20 text-orange-300">
                  <Flame className="h-3.5 w-3.5" />
                  Burns after first read
                </div>
              )}
              {shareData?.expiresInMinutes && (
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs bg-blue-500/10 border border-blue-500/20 text-blue-300">
                  <Clock className="h-3.5 w-3.5" />
                  Expires in {shareData.expiresInMinutes < 60 ? `${shareData.expiresInMinutes} min` : shareData.expiresInMinutes < 1440 ? `${shareData.expiresInMinutes / 60} hr` : `${shareData.expiresInMinutes / 1440} days`}
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                Read-only URL
                <span className="text-xs text-white/50">(recommended for sharing)</span>
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-[#0A0A0A] border-[1px] border-[#222222] px-3 py-2 text-xs font-mono break-all">
                  {shareData?.viewOnlyUrl}
                </code>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => shareData && copyToClipboard(shareData.viewOnlyUrl, 'view')}
                  className="bg-[#0A0A0A] border-[1px] border-[#222222] rounded-none hover:bg-[#0A0A0A] hover:text-primary"
                >
                  {copiedView ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>


            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                Editable URL
                <span className="text-xs text-destructive">(recommended to keep private)</span>
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-[#0A0A0A] border-[1px] border-[#222222] px-3 py-2 text-xs font-mono break-all">
                  {shareData?.editableUrl}
                </code>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => shareData && copyToClipboard(shareData.editableUrl, 'edit')}
                  className="bg-[#0A0A0A] border-[1px] border-[#222222] rounded-none hover:bg-[#0A0A0A] hover:text-primary"
                >
                  {copiedEdit ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-200/80 italic">
                <strong>Important:</strong> Since we dont't save your decryption key, we cannot recover your data if you lose the link.
                Please keep your URLs safe.
              </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0A0A0A] border-[1px] border-[#222222] rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Delete paste
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Are you sure you want to delete this paste? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="bg-[#0A0A0A] border-[1px] border-[#222222] rounded-none hover:bg-[#0A0A0A] hover:text-primary"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteContent}
              disabled={isLoading}
              className="rounded-none"
            >
              {isLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Index;
