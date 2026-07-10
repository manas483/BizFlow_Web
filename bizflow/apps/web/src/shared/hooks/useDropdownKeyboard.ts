"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DropdownItem {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface UseDropdownKeyboardOptions {
  /** The list of items in the dropdown. */
  items: DropdownItem[];
  /** Whether the dropdown is currently open. */
  isOpen: boolean;
  /** Called when the user selects / toggles an item via Enter. */
  onSelect: (value: string) => void;
  /** Called to close the dropdown. */
  onClose: () => void;
  /** Called to open the dropdown. */
  onOpen: () => void;
  /** The currently selected value (single-select) — used to set the initial highlight. */
  selectedValue?: string;
  /** The currently selected values (multi-select) — not used for highlight, only for ARIA. */
  selectedValues?: string[];
  /** Whether Enter should close the dropdown after selection (true for single, false for multi). */
  closeOnSelect?: boolean;
  /** Milliseconds before the type-to-search buffer resets. Defaults to 1000. */
  searchResetMs?: number;
}

export interface DropdownKeyboardReturn {
  /** Index of the currently highlighted item (-1 if none). */
  highlightedIndex: number;
  /** Manually set the highlighted index (e.g. on mouse hover). */
  setHighlightedIndex: (index: number) => void;
  /** Attach this to the trigger element's onKeyDown. */
  handleKeyDown: (e: React.KeyboardEvent) => void;
  /** A stable unique ID for the listbox — use for aria-controls. */
  listboxId: string;
  /** Returns the ID string for an option at a given index — use for each option's id attribute. */
  getOptionId: (index: number) => string;
  /** The ID of the currently highlighted option — use for aria-activedescendant. */
  activeDescendantId: string | undefined;
  /** Ref to attach to the scrollable dropdown panel for auto-scroll. */
  listRef: React.RefObject<HTMLDivElement | null>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_SEARCH_RESET_MS = 1000;
const PAGE_JUMP_SIZE = 5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Find the next enabled index in a given direction, wrapping around.
 * Returns -1 only if every item is disabled.
 */
function findNextEnabledIndex(
  items: DropdownItem[],
  startIndex: number,
  direction: 1 | -1,
): number {
  const len = items.length;
  if (len === 0) return -1;

  let idx = startIndex;
  for (let i = 0; i < len; i++) {
    idx = ((idx % len) + len) % len; // normalise to 0..len-1
    if (!items[idx]?.disabled) return idx;
    idx += direction;
  }
  return -1; // all disabled
}

/**
 * Find the nearest enabled index to `target`, searching outward in `direction`.
 */
function clampToEnabled(
  items: DropdownItem[],
  target: number,
  direction: 1 | -1,
): number {
  const clamped = Math.max(0, Math.min(target, items.length - 1));
  return findNextEnabledIndex(items, clamped, direction);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

let idCounter = 0;

export function useDropdownKeyboard({
  items,
  isOpen,
  onSelect,
  onClose,
  onOpen,
  selectedValue,
  closeOnSelect = true,
  searchResetMs = DEFAULT_SEARCH_RESET_MS,
}: UseDropdownKeyboardOptions): DropdownKeyboardReturn {
  // Stable unique IDs for ARIA (per component instance)
  const instanceId = useRef(`dropdown-kb-${++idCounter}`).current;
  const listboxId = `${instanceId}-listbox`;
  const getOptionId = useCallback(
    (index: number) => `${instanceId}-option-${index}`,
    [instanceId],
  );

  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Refs for the search buffer (not state — avoids re-renders on every keystroke)
  const searchBuffer = useRef("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const listRef = useRef<HTMLDivElement | null>(null);

  // ── Sync highlight when the dropdown opens ──────────────────────────────
  useEffect(() => {
    if (isOpen) {
      // If the user opened the dropdown by typing, the search logic already 
      // set the correct highlightedIndex. Do not overwrite it.
      if (searchBuffer.current.length > 0) return;

      // If there is a currently selected value, highlight it
      if (selectedValue != null && selectedValue !== "") {
        const idx = items.findIndex((o) => o.value === selectedValue);
        if (idx >= 0 && !items[idx]?.disabled) {
          setHighlightedIndex(idx);
        } else {
          // Selected item is disabled or not found — go to first enabled
          setHighlightedIndex(findNextEnabledIndex(items, 0, 1));
        }
      } else {
        setHighlightedIndex(findNextEnabledIndex(items, 0, 1));
      }
    } else {
      // Reset when closed
      searchBuffer.current = "";
      clearTimeout(searchTimeout.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Clamp highlighted index when items change while open ────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (items.length === 0) {
      setHighlightedIndex(-1);
      return;
    }
    setHighlightedIndex((prev) => {
      if (prev < 0 || prev >= items.length) {
        return findNextEnabledIndex(items, 0, 1);
      }
      if (items[prev]?.disabled) {
        return findNextEnabledIndex(items, prev, 1);
      }
      return prev;
    });
  }, [items, isOpen]);

  // ── Auto-scroll highlighted item into view ──────────────────────────────
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector(
      `[data-option-index="${highlightedIndex}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightedIndex, isOpen]);

  // ── Keyboard handler ───────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ignore IME composition
      if (e.nativeEvent.isComposing) return;

      // Ignore modifier combos (Ctrl+C, Alt+X, etc.) — except Shift (for uppercase letters)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const len = items.length;

      // ── If the dropdown is closed, some keys should open it ──
      if (!isOpen) {
        if (
          e.key === "ArrowDown" ||
          e.key === "ArrowUp" ||
          e.key === "Enter" ||
          e.key === " "
        ) {
          e.preventDefault();
          onOpen();
          return;
        }

        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          onOpen();
          // Let it fall through to the type-to-search logic below
        } else {
          return;
        }
      }

      // ── Dropdown is open ──

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          if (len === 0) return;
          const next = findNextEnabledIndex(
            items,
            highlightedIndex + 1,
            1,
          );
          if (next >= 0) setHighlightedIndex(next);
          break;
        }

        case "ArrowUp": {
          e.preventDefault();
          if (len === 0) return;
          const prev = findNextEnabledIndex(
            items,
            highlightedIndex - 1 < 0 ? len - 1 : highlightedIndex - 1,
            -1,
          );
          if (prev >= 0) setHighlightedIndex(prev);
          break;
        }

        case "Home": {
          e.preventDefault();
          const first = findNextEnabledIndex(items, 0, 1);
          if (first >= 0) setHighlightedIndex(first);
          break;
        }

        case "End": {
          e.preventDefault();
          const last = findNextEnabledIndex(items, len - 1, -1);
          if (last >= 0) setHighlightedIndex(last);
          break;
        }

        case "PageDown": {
          e.preventDefault();
          const target = Math.min(
            highlightedIndex + PAGE_JUMP_SIZE,
            len - 1,
          );
          const idx = clampToEnabled(items, target, 1);
          if (idx >= 0) setHighlightedIndex(idx);
          break;
        }

        case "PageUp": {
          e.preventDefault();
          const target = Math.max(highlightedIndex - PAGE_JUMP_SIZE, 0);
          const idx = clampToEnabled(items, target, -1);
          if (idx >= 0) setHighlightedIndex(idx);
          break;
        }

        case "Enter": {
          e.preventDefault();
          if (
            highlightedIndex >= 0 &&
            highlightedIndex < len &&
            !items[highlightedIndex]?.disabled
          ) {
            onSelect(items[highlightedIndex].value);
            if (closeOnSelect) onClose();
          }
          break;
        }

        case "Escape": {
          e.preventDefault();
          e.stopPropagation(); // Don't let Escape bubble to the parent modal
          onClose();
          break;
        }

        case "Tab": {
          // Let Tab propagate for natural focus movement, but close the dropdown
          onClose();
          break;
        }

        default: {
          // ── Type-to-search ──
          if (e.key.length !== 1) return; // ignore non-character keys

          e.preventDefault();
          const char = e.key.toLowerCase();

          clearTimeout(searchTimeout.current);
          searchTimeout.current = setTimeout(() => {
            searchBuffer.current = "";
          }, searchResetMs);

          const prevBuffer = searchBuffer.current;
          searchBuffer.current += char;
          const buffer = searchBuffer.current;

          // ── Single repeated character → cycle through matches ──
          const isSingleRepeatedChar =
            buffer.length > 1 &&
            buffer.split("").every((c) => c === buffer[0]);

          if (isSingleRepeatedChar) {
            // Find all enabled items starting with this character
            const matchingIndices: number[] = [];
            for (let i = 0; i < len; i++) {
              if (
                !items[i].disabled &&
                items[i].label.toLowerCase().includes(char)
              ) {
                matchingIndices.push(i);
              }
            }

            if (matchingIndices.length > 0) {
              // Find where current highlight sits among matches, advance to next
              const currentPos = matchingIndices.indexOf(highlightedIndex);
              const nextPos =
                currentPos < 0
                  ? 0
                  : (currentPos + 1) % matchingIndices.length;
              setHighlightedIndex(matchingIndices[nextPos]);
            }
          } else {
            // ── Multi-character incremental search ──
            let foundIndex = -1;

            // Search from after current highlight first (for wrap-around feel)
            const startFrom = prevBuffer === "" ? 0 : Math.max(0, highlightedIndex);
            for (let i = 0; i < len; i++) {
              const idx = (startFrom + i) % len;
              if (
                !items[idx].disabled &&
                items[idx].label.toLowerCase().includes(buffer)
              ) {
                foundIndex = idx;
                break;
              }
            }

            if (foundIndex >= 0) {
              setHighlightedIndex(foundIndex);
            }
          }
          break;
        }
      }
    },
    [
      items,
      isOpen,
      highlightedIndex,
      onSelect,
      onClose,
      onOpen,
      closeOnSelect,
      searchResetMs,
    ],
  );

  // ── Clean up timeout on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => clearTimeout(searchTimeout.current);
  }, []);

  const activeDescendantId =
    isOpen && highlightedIndex >= 0
      ? getOptionId(highlightedIndex)
      : undefined;

  return {
    highlightedIndex,
    setHighlightedIndex,
    handleKeyDown,
    listboxId,
    getOptionId,
    activeDescendantId,
    listRef,
  };
}
