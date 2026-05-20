/// BizFlow — Splash Screen
///
/// Per spec:
///  - Always dark (ignores system theme)
///  - Staged animation sequence: logo spring → title fade → tagline fade → progress bar
///  - BrandSpinner replaces CircularProgressIndicator
///  - Screen fades out once auth resolves (GoRouter handles redirect)
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/providers/auth_provider.dart';
import '../../shared/widgets/brand_spinner.dart';
import '../theme/colors.dart';
import '../theme/spacing.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with TickerProviderStateMixin {
  // ── Animation controllers ─────────────────────────────
  late final AnimationController _logoCtrl;
  late final AnimationController _titleCtrl;
  late final AnimationController _taglineCtrl;
  late final AnimationController _progressCtrl;

  // ── Animations ────────────────────────────────────────
  late final Animation<double> _logoScale;
  late final Animation<double> _logoOpacity;
  late final Animation<double> _titleOpacity;
  late final Animation<double> _taglineOpacity;
  late final Animation<double> _progressValue;

  @override
  void initState() {
    super.initState();
    _setupAnimations();
    _runSequence();

    // Initialize auth state after first frame
    Future.microtask(() {
      ref.read(authProvider.notifier).initialize();
    });
  }

  void _setupAnimations() {
    // Logo: spring 0.6 → 1.0 over 300ms
    _logoCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _logoScale = Tween<double>(begin: 0.6, end: 1.0).animate(
      CurvedAnimation(parent: _logoCtrl, curve: Curves.easeOutBack),
    );
    _logoOpacity = CurvedAnimation(parent: _logoCtrl, curve: Curves.easeOut);

    // Title: fade in over 200ms (delay 150ms)
    _titleCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
    _titleOpacity = CurvedAnimation(parent: _titleCtrl, curve: Curves.easeOut);

    // Tagline: fade in over 200ms (delay 400ms)
    _taglineCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
    _taglineOpacity =
        CurvedAnimation(parent: _taglineCtrl, curve: Curves.easeOut);

    // Progress bar: 0 → 1.0 over 1200ms (starts after tagline)
    _progressCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _progressValue = CurvedAnimation(
      parent: _progressCtrl,
      curve: Curves.easeInOut,
    );
  }

  Future<void> _runSequence() async {
    // Logo spring
    await _logoCtrl.forward();

    // Title fade after 150ms gap
    await Future.delayed(const Duration(milliseconds: 150));
    await _titleCtrl.forward();

    // Tagline fade after 250ms gap
    await Future.delayed(const Duration(milliseconds: 250));
    _taglineCtrl.forward();

    // Progress bar starts simultaneously with tagline
    _progressCtrl.forward();
  }

  @override
  void dispose() {
    _logoCtrl.dispose();
    _titleCtrl.dispose();
    _taglineCtrl.dispose();
    _progressCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Always dark — per spec (ignores system theme)
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      body: SafeArea(
        child: Column(
          children: [
            // ── Centre content ────────────────────────────
            Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Logo
                    ScaleTransition(
                      scale: _logoScale,
                      child: FadeTransition(
                        opacity: _logoOpacity,
                        child: Container(
                          width: 72,
                          height: 72,
                          decoration: BoxDecoration(
                            gradient: AppColors.brandGradient,
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.brand500.withValues(alpha: 0.35),
                                blurRadius: 32,
                                offset: const Offset(0, 10),
                              ),
                            ],
                          ),
                          child: const Icon(
                            Icons.bolt_rounded,
                            size: 38,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: AppSpacing.lg),

                    // Brand title — gradient ShaderMask
                    FadeTransition(
                      opacity: _titleOpacity,
                      child: ShaderMask(
                        shaderCallback: (bounds) =>
                            AppColors.brandGradient.createShader(bounds),
                        child: Text(
                          'BizFlow',
                          style:
                              Theme.of(context).textTheme.headlineLarge?.copyWith(
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                    letterSpacing: -1.0,
                                  ),
                        ),
                      ),
                    ),

                    const SizedBox(height: AppSpacing.sm),

                    // Tagline
                    FadeTransition(
                      opacity: _taglineOpacity,
                      child: Text(
                        'Business at your fingertips',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppColors.darkTextMuted,
                            ),
                      ),
                    ),

                    const SizedBox(height: AppSpacing.xxxl),

                    // BrandSpinner (replaces CircularProgressIndicator)
                    const BrandSpinner(),
                  ],
                ),
              ),
            ),

            // ── Brand gradient progress bar at bottom ──────
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.xxl,
                0,
                AppSpacing.xxl,
                AppSpacing.xl,
              ),
              child: AnimatedBuilder(
                animation: _progressValue,
                builder: (_, __) => ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: LinearProgressIndicator(
                    value: _progressValue.value,
                    backgroundColor: AppColors.darkBorder,
                    valueColor: const AlwaysStoppedAnimation<Color>(
                      AppColors.brand500,
                    ),
                    minHeight: 3,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
