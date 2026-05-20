/// BizFlow Design Tokens — Color System
///
/// Extracted from the web app's globals.css to ensure perfect branding alignment.
/// All colors are centralized here. NEVER hardcode colors elsewhere.
library;

import 'package:flutter/material.dart';

abstract final class AppColors {
  // ══════════════════════════════════════════════════════
  //  BRAND — Violet/Indigo gradient palette
  // ══════════════════════════════════════════════════════
  static const Color brand50  = Color(0xFFEEF2FF);
  static const Color brand100 = Color(0xFFE0E7FF);
  static const Color brand200 = Color(0xFFC7D2FE);
  static const Color brand300 = Color(0xFFA5B4FC);
  static const Color brand400 = Color(0xFF818CF8);
  static const Color brand500 = Color(0xFF6366F1); // Indigo primary
  static const Color brand600 = Color(0xFF4F46E5);
  static const Color brand700 = Color(0xFF4338CA);
  static const Color brand800 = Color(0xFF3730A3);
  static const Color brand900 = Color(0xFF312E81);

  /// Violet accent
  static const Color violet500 = Color(0xFF8B5CF6);

  // ══════════════════════════════════════════════════════
  //  DARK MODE — matches web :root tokens
  // ══════════════════════════════════════════════════════
  static const Color darkBg       = Color(0xFF0D0D1A);
  static const Color darkSurface  = Color(0xFF13131F);
  static const Color darkSurface2 = Color(0xFF1A1A2E);
  static const Color darkSurface3 = Color(0x08FFFFFF); // rgba(255,255,255,0.03)
  static const Color darkBorder   = Color(0x0DFFFFFF); // rgba(255,255,255,0.05)
  static const Color darkBorderHover = Color(0x4D8B5CF6); // rgba(139,92,246,0.3)
  static const Color darkTextPrimary   = Color(0xFFFFFFFF);
  static const Color darkTextSecondary = Color(0x80FFFFFF); // rgba(255,255,255,0.5)
  static const Color darkTextMuted     = Color(0x4DFFFFFF); // rgba(255,255,255,0.3)
  static const Color darkInputBg     = Color(0x0DFFFFFF); // rgba(255,255,255,0.05)
  static const Color darkInputBorder = Color(0x1AFFFFFF); // rgba(255,255,255,0.10)

  // ══════════════════════════════════════════════════════
  //  LIGHT MODE — matches web html.light :root tokens
  // ══════════════════════════════════════════════════════
  static const Color lightBg       = Color(0xFFF8F9FB); // Crisper off-white
  static const Color lightSurface  = Color(0xFFFFFFFF);
  static const Color lightSurface2 = Color(0xFFF3F4F6);
  static const Color lightSurface3 = Color(0x0A000000); // rgba(0,0,0,0.04)
  static const Color lightBorder   = Color(0x14000000); // rgba(0,0,0,0.08)
  static const Color lightBorderHover = Color(0x596D28D9); // rgba(109,40,217,0.35)
  static const Color lightTextPrimary   = Color(0xFF0F0F1A);
  static const Color lightTextSecondary = Color(0x8C0F0F1A); // rgba(15,15,26,0.55)
  static const Color lightTextMuted     = Color(0x590F0F1A); // rgba(15,15,26,0.35)
  static const Color lightInputBg     = Color(0x0A000000); // rgba(0,0,0,0.04)
  static const Color lightInputBorder = Color(0x1F000000); // rgba(0,0,0,0.12)

  // ══════════════════════════════════════════════════════
  //  SEMANTIC
  // ══════════════════════════════════════════════════════
  static const Color success   = Color(0xFF10B981); // Emerald
  static const Color warning   = Color(0xFFF59E0B); // Amber
  static const Color error     = Color(0xFFEF4444); // Red
  static const Color info      = Color(0xFF3B82F6); // Blue

  // ══════════════════════════════════════════════════════
  //  PASTEL SURFACES (for icons / badges)
  // ══════════════════════════════════════════════════════
  static const Color pastelSuccess = Color(0xFFD1FAE5);
  static const Color pastelWarning = Color(0xFFFEF3C7);
  static const Color pastelError   = Color(0xFFFEE2E2);
  static const Color pastelInfo    = Color(0xFFDBEAFE);
  static const Color pastelBrand   = Color(0xFFE0E7FF);

  // ══════════════════════════════════════════════════════
  //  STATUS COLORS (stock indicators, etc.)
  // ══════════════════════════════════════════════════════
  static const Color stockHigh   = Color(0xFF22C55E); // Green — good stock
  static const Color stockMedium = Color(0xFFF59E0B); // Amber — getting low
  static const Color stockLow    = Color(0xFFEF4444); // Red — critical
  static const Color stockOut    = Color(0xFF6B7280); // Gray — out of stock

  // ══════════════════════════════════════════════════════
  //  GRADIENTS
  // ══════════════════════════════════════════════════════
  static const LinearGradient brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [brand500, brand400, brand300],
  );

  static const LinearGradient darkSurfaceGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [darkSurface, darkSurface2],
  );

  static const LinearGradient shimmerGradientDark = LinearGradient(
    colors: [
      Color(0x0DFFFFFF),
      Color(0x1AFFFFFF),
      Color(0x0DFFFFFF),
    ],
  );

  static const LinearGradient shimmerGradientLight = LinearGradient(
    colors: [
      Color(0x0A000000),
      Color(0x14000000),
      Color(0x0A000000),
    ],
  );
}
