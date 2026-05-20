/// BizFlow Design Tokens — Shadows
///
/// Elevation/shadow tokens matching web app's glassmorphism style.
library;

import 'package:flutter/material.dart';
import 'colors.dart';

abstract final class AppShadows {
  // ══════════════════════════════════════════════════════
  //  DARK MODE SHADOWS
  // ══════════════════════════════════════════════════════
  static const List<BoxShadow> cardDark = [
    BoxShadow(
      color: Color(0x26000000), // 15% black
      blurRadius: 16,
      offset: Offset(0, 4),
    ),
  ];

  static const List<BoxShadow> elevatedDark = [
    BoxShadow(
      color: Color(0x40000000), // 25% black
      blurRadius: 32,
      offset: Offset(0, 12),
    ),
  ];

  static const List<BoxShadow> modalDark = [
    BoxShadow(
      color: Color(0x80000000),
      blurRadius: 50,
      offset: Offset(0, 25),
    ),
  ];

  /// Glow effect for brand-colored elements
  static List<BoxShadow> brandGlowDark = [
    BoxShadow(
      color: AppColors.brand500.withValues(alpha: 0.25),
      blurRadius: 20,
      offset: const Offset(0, 4),
    ),
  ];

  // ══════════════════════════════════════════════════════
  //  LIGHT MODE SHADOWS
  // ══════════════════════════════════════════════════════
  static const List<BoxShadow> cardLight = [
    BoxShadow(
      color: Color(0x08000000), // 3% black for ultra-soft shadow
      blurRadius: 16,
      offset: Offset(0, 4),
    ),
  ];

  static const List<BoxShadow> elevatedLight = [
    BoxShadow(
      color: Color(0x0D000000), // 5% black
      blurRadius: 32,
      offset: Offset(0, 12),
    ),
  ];

  static const List<BoxShadow> modalLight = [
    BoxShadow(
      color: Color(0x33000000),
      blurRadius: 50,
      offset: Offset(0, 25),
    ),
  ];

  static List<BoxShadow> brandGlowLight = [
    BoxShadow(
      color: AppColors.brand600.withValues(alpha: 0.15),
      blurRadius: 20,
      offset: const Offset(0, 4),
    ),
  ];

  // ══════════════════════════════════════════════════════
  //  CONVENIENCE — pick by brightness
  // ══════════════════════════════════════════════════════
  static List<BoxShadow> card(Brightness b) =>
      b == Brightness.dark ? cardDark : cardLight;

  static List<BoxShadow> elevated(Brightness b) =>
      b == Brightness.dark ? elevatedDark : elevatedLight;

  static List<BoxShadow> modal(Brightness b) =>
      b == Brightness.dark ? modalDark : modalLight;

  static List<BoxShadow> brandGlow(Brightness b) =>
      b == Brightness.dark ? brandGlowDark : brandGlowLight;
}
