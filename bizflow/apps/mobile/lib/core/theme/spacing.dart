/// BizFlow Design Tokens — Spacing
///
/// Consistent spacing scale used throughout the app.
/// Based on a 4px grid system for pixel-perfect alignment.
library;

abstract final class AppSpacing {
  // ── Base grid ─────────────────────────────────────────
  static const double xs   = 4.0;
  static const double sm   = 8.0;
  static const double md   = 12.0;
  static const double base = 16.0;
  static const double lg   = 20.0;
  static const double xl   = 24.0;
  static const double xxl  = 32.0;
  static const double xxxl = 40.0;
  static const double huge = 48.0;
  static const double mega = 64.0;

  // ── Page-level padding ────────────────────────────────
  static const double pagePaddingH = 20.0; // Increased for better breathing room
  static const double pagePaddingV = 16.0; // Increased vertical margin

  // ── Card internal padding ─────────────────────────────
  static const double cardPaddingH = 20.0;
  static const double cardPaddingV = 16.0;

  // ── Section spacing ───────────────────────────────────
  static const double sectionGap  = 24.0;  // Between major sections
  static const double itemGap     = 12.0;  // Between list items
  static const double inlineGap   = 8.0;   // Between inline elements

  // ── Bottom nav bar safe area ──────────────────────────
  static const double bottomNavHeight = 64.0;
  static const double fabOffset       = 80.0; // clearance above bottom nav
}
