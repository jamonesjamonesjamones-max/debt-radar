/**
 * FileDropZone — Drag & drop area for uploading a single file to analyze.
 */

import { useState, useRef, useCallback } from "react";
import { CheckIcon, CloseIcon } from "./ui/Icons";

const ALLOWED_TYPES = [".py", ".js", ".jsx", ".ts", ".tsx"];
const MAX_SIZE = 1 * 1024 * 1024;

function UploadIcon({size, className}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true"><path d="M12 16V4M8 8l4-4 4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}
function FileIcon({size, className}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2"/><path d="M14 2v6h6" stroke="currentColor" strokeWidth="2"/></svg>;
}
// CheckIcon and CloseIcon imported from ./ui/Icons

export default function FileDropZone({ onFileSelected, disabled }) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const validateFile = useCallback((file) => {
    if (!file) return "No file selected";
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!ALLOWED_TYPES.includes(ext)) {
      return "Unsupported file type \"" + ext + "\". Allowed: " + ALLOWED_TYPES.join(", ");
    }
    if (file.size > MAX_SIZE) {
      return "File too large (" + (file.size / 1024).toFixed(0) + "KB). Maximum is " + (MAX_SIZE / 1024) + "KB.";
    }
    if (file.size === 0) return "File is empty";
    return null;
  }, []);

  const handleFile = useCallback((file) => {
    setError("");
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  }, [validateFile]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [disabled, handleFile]);

  const handleDragOver = (e) => { e.preventDefault(); if (!disabled) setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const handleClick = () => { if (!disabled) inputRef.current?.click(); };
  const handleInputChange = (e) => { const file = e.target.files?.[0]; if (file) handleFile(file); };
  const handleClear = () => { setSelectedFile(null); setError(""); if (inputRef.current) inputRef.current.value = ""; };
  const handleAnalyze = () => { if (selectedFile && onFileSelected) onFileSelected(selectedFile); };

  return (
    <div className="w-full max-w-md mx-auto">
      <input ref={inputRef} type="file" accept={ALLOWED_TYPES.join(",")} onChange={handleInputChange} className="hidden" aria-hidden="true" tabIndex={-1} />
      <div
        role="button" tabIndex={disabled ? -1 : 0}
        aria-label="Upload a file to analyze"
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !disabled) { e.preventDefault(); handleClick(); } }}
        className={
          "relative border-2 border-dashed rounded-card p-5 transition-all duration-200 ease-out cursor-pointer text-center " +
          (disabled ? "opacity-40 cursor-not-allowed " : "") +
          (dragOver ? "border-accent bg-accent/5 scale-[1.02] " : "") +
          (selectedFile && !dragOver ? "border-semantic-success/50 bg-semantic-success-bg/30 " : "") +
          (error && !selectedFile ? "border-semantic-error/50 bg-semantic-error-bg/20 " : "") +
          (!selectedFile && !error && !dragOver ? "border-surface-4 hover:border-accent/40 hover:bg-surface-2/50 " : "")
        }
      >
        <div className="flex flex-col items-center gap-2.5">
          {selectedFile ? (
            <>
              <div className="w-10 h-10 rounded-full bg-semantic-success-bg flex items-center justify-center">
                <CheckIcon size={20} className="text-semantic-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary break-all">{selectedFile.name}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleClear(); }} className="btn-ghost btn-sm !px-2 text-[10px]" aria-label="Remove selected file">
                <CloseIcon size={12} /> Remove
              </button>
            </>
          ) : (
            <>
              <div className={"w-10 h-10 rounded-full flex items-center justify-center " + (dragOver ? "bg-accent/15" : "bg-surface-3")}>
                <UploadIcon size={20} className={dragOver ? "text-accent" : "text-text-muted"} />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{dragOver ? "Drop file here" : "Upload a file to analyze"}</p>
                <p className="text-[11px] text-text-muted mt-0.5">Drag & drop or click to browse</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {ALLOWED_TYPES.map(function(ext) { return <span key={ext} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-text-muted">{ext}</span>; })}
              </div>
              <p className="text-[9px] text-text-muted">Max 1MB</p>
            </>
          )}
        </div>
        {error && <p className="mt-2 text-[10px] text-semantic-error">{error}</p>}
      </div>
      {selectedFile && (
        <button onClick={handleAnalyze} disabled={disabled} className="btn-primary btn-sm w-full mt-3 btn-magnetic">
          <FileIcon size={14} />
          Analyze this file
        </button>
      )}
    </div>
  );
}
