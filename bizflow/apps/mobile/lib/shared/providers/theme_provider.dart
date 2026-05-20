/// BizFlow — Theme Provider
///
/// Manages dark/light/system theme mode with local persistence.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/storage/storage.dart';

class ThemeNotifier extends StateNotifier<ThemeMode> {
  final LocalStorage _localStorage;

  ThemeNotifier(this._localStorage) : super(ThemeMode.system) {
    _loadSavedTheme();
  }

  void _loadSavedTheme() {
    final saved = _localStorage.themeMode;
    if (saved != null) {
      state = switch (saved) {
        'dark'   => ThemeMode.dark,
        'light'  => ThemeMode.light,
        _        => ThemeMode.system,
      };
    }
  }

  void setThemeMode(ThemeMode mode) {
    state = mode;
    _localStorage.setThemeMode(switch (mode) {
      ThemeMode.dark   => 'dark',
      ThemeMode.light  => 'light',
      ThemeMode.system => 'system',
    });
  }

  void toggleTheme() {
    setThemeMode(state == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark);
  }

  bool get isDark => state == ThemeMode.dark;
  bool get isLight => state == ThemeMode.light;
  bool get isSystem => state == ThemeMode.system;
}

final themeProvider = StateNotifierProvider<ThemeNotifier, ThemeMode>((ref) {
  final localStorage = ref.read(localStorageProvider);
  return ThemeNotifier(localStorage);
});
