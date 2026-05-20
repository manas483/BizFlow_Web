/// BizFlow Design Tokens — Border Radius
///
/// Consistent radius values matching web app's design language.
library;

import 'package:flutter/material.dart';

abstract final class AppRadius {
  // ── Raw values ────────────────────────────────────────
  static const double xs   = 4.0;
  static const double sm   = 8.0;
  static const double md   = 12.0;
  static const double lg   = 16.0;
  static const double xl   = 20.0;
  static const double xxl  = 24.0;
  static const double full = 999.0;

  // ── Pre-built BorderRadius ────────────────────────────
  static final BorderRadius radiusXs  = BorderRadius.circular(xs);
  static final BorderRadius radiusSm  = BorderRadius.circular(sm);
  static final BorderRadius radiusMd  = BorderRadius.circular(md);
  static final BorderRadius radiusLg  = BorderRadius.circular(lg);
  static final BorderRadius radiusXl  = BorderRadius.circular(xl);
  static final BorderRadius radiusXxl = BorderRadius.circular(xxl);
  static final BorderRadius radiusFull = BorderRadius.circular(full);

  // ── Card radius (matches web 12px) ────────────────────
  static final BorderRadius card = BorderRadius.circular(md);

  // ── Button radius ─────────────────────────────────────
  static final BorderRadius button = BorderRadius.circular(md);

  // ── Input radius (matches web 12px) ───────────────────
  static final BorderRadius input = BorderRadius.circular(md);

  // ── Bottom sheet ──────────────────────────────────────
  static const BorderRadius bottomSheet = BorderRadius.only(
    topLeft: Radius.circular(xxl),
    topRight: Radius.circular(xxl),
  );
}
