/// BizFlow Design Tokens — Typography
///
/// Uses Google Fonts (Inter) for modern SaaS UI consistency.
/// Matches the web app's font system.
library;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

abstract final class AppTypography {
  // ── Base font family ──────────────────────────────────
  static String get fontFamily => GoogleFonts.inter().fontFamily!;

  // ── Text Theme builder ────────────────────────────────
  static TextTheme textTheme(Brightness brightness) {
    final base = GoogleFonts.interTextTheme(
      brightness == Brightness.dark
          ? ThemeData.dark().textTheme
          : ThemeData.light().textTheme,
    );

    return base.copyWith(
      // Display
      displayLarge:  base.displayLarge?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -1.5),
      displayMedium: base.displayMedium?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.5),
      displaySmall:  base.displaySmall?.copyWith(fontWeight: FontWeight.w600),

      // Headline
      headlineLarge:  base.headlineLarge?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.5),
      headlineMedium: base.headlineMedium?.copyWith(fontWeight: FontWeight.w600),
      headlineSmall:  base.headlineSmall?.copyWith(fontWeight: FontWeight.w600),

      // Title
      titleLarge:  base.titleLarge?.copyWith(fontWeight: FontWeight.w600, letterSpacing: -0.25),
      titleMedium: base.titleMedium?.copyWith(fontWeight: FontWeight.w600),
      titleSmall:  base.titleSmall?.copyWith(fontWeight: FontWeight.w600),

      // Body
      bodyLarge:  base.bodyLarge?.copyWith(fontWeight: FontWeight.w400, height: 1.5),
      bodyMedium: base.bodyMedium?.copyWith(fontWeight: FontWeight.w400, height: 1.5),
      bodySmall:  base.bodySmall?.copyWith(fontWeight: FontWeight.w400, height: 1.5),

      // Label
      labelLarge:  base.labelLarge?.copyWith(fontWeight: FontWeight.w600, letterSpacing: 0.1),
      labelMedium: base.labelMedium?.copyWith(fontWeight: FontWeight.w500),
      labelSmall:  base.labelSmall?.copyWith(fontWeight: FontWeight.w500, letterSpacing: 0.5),
    );
  }

  // ══════════════════════════════════════════════════════
  //  CUSTOM STYLES (for use outside TextTheme)
  // ══════════════════════════════════════════════════════

  /// KPI card value — large bold number
  static TextStyle kpiValue(Color color) => GoogleFonts.inter(
    fontSize: 28,
    fontWeight: FontWeight.w800, // Punchier weight
    color: color,
    letterSpacing: -1.0, // Tighter tracking for large numbers
    height: 1.2,
  );

  /// Section header
  static TextStyle sectionHeader(Color color) => GoogleFonts.inter(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    color: color,
    letterSpacing: -0.25,
  );

  /// Small badge / chip label
  static TextStyle chipLabel(Color color) => GoogleFonts.inter(
    fontSize: 11,
    fontWeight: FontWeight.w600,
    color: color,
    letterSpacing: 0.5,
  );

  /// Gradient-ready text (used with ShaderMask)
  static TextStyle gradientTitle = GoogleFonts.inter(
    fontSize: 24,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.5,
  );
}
