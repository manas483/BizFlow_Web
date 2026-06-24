export function computeStringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  
  // Replace non-alphanumeric with spaces, collapse multiple spaces, and trim
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const normA = normalize(a);
  const normB = normalize(b);
  
  if (normA === normB) return 1.0;
  
  // Exact substring match (handles "Vishal Gaurav" inside "Vishal Gaurav 6 KG")
  if (normA.includes(normB) || normB.includes(normA)) return 0.8;
  
  // Word overlap
  const wordsA = new Set(normA.split(' ').filter(w => w.length > 1));
  const wordsB = new Set(normB.split(' ').filter(w => w.length > 1));
  
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  
  let overlap = 0;
  wordsA.forEach(w => {
    if (wordsB.has(w)) overlap++;
    else {
      // Allow partial word match if it's long enough
      for (const wB of wordsB) {
        if (w.length > 3 && wB.length > 3 && (w.includes(wB) || wB.includes(w))) {
          overlap += 0.8;
          break;
        }
      }
    }
  });
  
  // Use a weighted denominator so short DB names against long invoice names score higher
  const denominator = (Math.max(wordsA.size, wordsB.size) + Math.min(wordsA.size, wordsB.size)) / 2;
  const score = overlap / denominator;
  return score;
}

/**
 * Cleans up messy raw PDF product names when no existing DB match is found.
 * Example: "Vishal Gaurav 6 KG*6 (100 - 105" -> "Vishal Gaurav 6 KG"
 */
export function cleanProductName(rawName: string): string {
  if (!rawName) return "";
  
  let cleaned = rawName;
  
  // 1. Remove trailing unclosed or informational parentheses: e.g. "(100 - 105" or "(120-125 Days)" at the end
  cleaned = cleaned.replace(/\s*\([^\)]*$/, '');
  cleaned = cleaned.replace(/\s*\([^)]*\)\s*$/, '');

  // 2. Remove trailing packaging multipliers like "*6" or "x 6" or "* 12"
  cleaned = cleaned.replace(/\s*[\*xX]\s*\d+\s*$/, '');

  // 3. Remove trailing weights/quantities like "6 KG", "500g", "1 L"
  cleaned = cleaned.replace(/\s*\d+(\.\d+)?\s*(kg|g|gm|l|ml|pcs|nos)\s*$/i, '');

  // 4. Ensure a space before opening parenthesis (e.g. "Pan 804(Jamuna)" -> "Pan 804 (Jamuna)")
  cleaned = cleaned.replace(/([a-zA-Z0-9])\(/g, '$1 (');

  // 5. Collapse multiple spaces and trim
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Auto-generates a fallback SKU based on the product name.
 * Imitates the user's pattern (e.g. "Vishal Gaurav" -> "VSH-GR", "Yashraj" -> "YSH-RJ")
 */
export function generateFallbackSku(name: string): string {
  if (!name) return "";
  const parts = name.toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  
  const getConsonants = (str: string) => str.replace(/[AEIOU]/g, '');
  
  if (parts.length === 1) {
    const word = parts[0];
    const cons = getConsonants(word);
    // e.g. YASHRAJ -> YSHRJ -> YSH-RJ
    if (cons.length >= 5) return `${cons.slice(0, 3)}-${cons.slice(3, 5)}`;
    if (word.length >= 5) return `${word.slice(0, 3)}-${word.slice(3, 5)}`;
    return word.slice(0, 5);
  }
  
  // For multiple words: first 3 consonants of first word + first 2 consonants of second word
  // e.g. VISHAL GAURAV -> VSH + GR -> VSH-GR
  const firstWordCons = getConsonants(parts[0]);
  const p1 = firstWordCons.length >= 3 ? firstWordCons.slice(0, 3) : parts[0].slice(0, 3);
  
  const secondWordCons = getConsonants(parts[1]);
  // Use first and last consonant of second word if possible to match "Gold" -> "GD"
  let p2 = "";
  if (secondWordCons.length >= 2) {
    p2 = secondWordCons[0] + secondWordCons[secondWordCons.length - 1];
  } else {
    p2 = parts[1].slice(0, 2);
  }
  
  return `${p1}-${p2}`.substring(0, 7);
}
