import React, { useEffect, useRef } from "react";
import { QrCode } from "lucide-react";

interface BarcodeInputProps {
  onScan: (barcode: string) => void;
  placeholder?: string;
}

export const BarcodeInput: React.FC<BarcodeInputProps> = ({
  onScan,
  placeholder = "Scan Barcode (F2)",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      // Focus barcode input on F2
      if (e.key === "F2") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = e.currentTarget.value.trim();
      if (val) {
        onScan(val);
        e.currentTarget.value = "";
      }
    }
  };

  return (
    <div className="relative w-48 sm:w-56">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-primary/40">
        <QrCode size={16} />
      </div>
      <input
        ref={inputRef}
        id="barcode-input"
        type="text"
        onKeyDown={handleKeyDown}
        className="w-full bg-primary/5 border border-primary/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-primary/40 focus:outline-none focus:border-violet-500/50 transition-all focus:ring-1 focus:ring-violet-500/20 font-mono"
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );
};
