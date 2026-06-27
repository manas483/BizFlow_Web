import React, { useEffect, useRef } from "react";
import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = "Search by product name, SKU, category, or HSN... (Ctrl+F)",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      // Focus search input on Ctrl+F
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, []);

  return (
    <div className="relative flex-1">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-primary/40">
        <Search size={16} />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-primary/5 border border-primary/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-primary/40 focus:outline-none focus:border-violet-500/50 transition-all focus:ring-1 focus:ring-violet-500/20"
        placeholder={placeholder}
      />
    </div>
  );
};
