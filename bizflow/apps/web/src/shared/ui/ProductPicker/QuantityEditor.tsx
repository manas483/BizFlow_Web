import React from "react";
import { Plus, Minus } from "lucide-react";

interface QuantityEditorProps {
  value: number;
  onChange: (qty: number) => void;
  maxStock?: number;
}

export const QuantityEditor: React.FC<QuantityEditorProps> = ({
  value,
  onChange,
  maxStock,
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      onChange(0);
      return;
    }
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    const sanitized = Math.max(0, num);
    onChange(maxStock !== undefined ? Math.min(sanitized, maxStock) : sanitized);
  };

  const increment = () => {
    const newVal = value + 1;
    onChange(maxStock !== undefined ? Math.min(newVal, maxStock) : newVal);
  };

  const decrement = () => {
    onChange(Math.max(0, value - 1));
  };

  return (
    <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden h-8">
      <button
        type="button"
        onClick={decrement}
        disabled={value <= 0}
        className="px-2 h-full flex items-center justify-center hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent text-primary/70 transition-colors"
      >
        <Minus size={12} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value === 0 ? "" : value}
        placeholder="0"
        onChange={handleInputChange}
        onFocus={(e) => e.target.select()}
        className="w-10 h-full text-center bg-transparent border-y-0 border-x border-white/10 text-xs text-white focus:outline-none font-mono"
      />
      <button
        type="button"
        onClick={increment}
        disabled={maxStock !== undefined && value >= maxStock}
        className="px-2 h-full flex items-center justify-center hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent text-primary/70 transition-colors"
      >
        <Plus size={12} />
      </button>
    </div>
  );
};
