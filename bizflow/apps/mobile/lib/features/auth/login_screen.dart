/// BizFlow — Login Screen
///
/// Per Phase 3 spec:
///  - Animated gradient blob background (two orbs, slow drift)
///  - Logo + wordmark with brand gradient ShaderMask
///  - GlassCard login card slides up from y+40 on entry (spring)
///  - AppTextField for email + password (animated focus border)
///  - Error → AppToast (top banner, auto-dismiss 4s) instead of inline container
///  - Tablet: card max-width 400dp, centered
///  - Never shows raw CircularProgressIndicator (BrandSpinner via AppButton)
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/colors.dart';
import '../../core/theme/spacing.dart';
import '../../core/theme/radius.dart';
import '../../shared/providers/auth_provider.dart';
import '../../shared/widgets/shared_widgets.dart';
import '../../shared/widgets/app_text_field.dart';
import '../../shared/widgets/app_toast.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();
  bool _obscurePassword = true;

  // ── Animations ────────────────────────────────────────
  late final AnimationController _cardCtrl;
  late final Animation<double> _cardOpacity;
  late final Animation<Offset> _cardSlide;

  @override
  void initState() {
    super.initState();

    // Card slides up from y+40 with spring
    _cardCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _cardOpacity = CurvedAnimation(parent: _cardCtrl, curve: Curves.easeOut);
    _cardSlide = Tween<Offset>(
      begin: const Offset(0, 0.08), // ~40px at typical screen height
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _cardCtrl, curve: Curves.easeOutCubic));

    _cardCtrl.forward();
  }

  @override
  void dispose() {
    _cardCtrl.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  void _onLogin() {
    if (!_formKey.currentState!.validate()) return;
    ref.read(authProvider.notifier).login(
          _emailController.text.trim(),
          _passwordController.text,
        );
  }

  // Watch auth state, show toast on new error
  String? _lastError;
  void _handleAuthState(AuthState authState) {
    final error = authState.error;
    if (error != null && error != _lastError) {
      _lastError = error;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) AppToast.error(context, error);
      });
    }
    if (!authState.isLoading) _lastError = null;
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final size = MediaQuery.of(context).size;

    // Side-effect: show toast on error
    _handleAuthState(authState);

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          // ── Background orbs ───────────────────────────
          Positioned(
            top: -size.height * 0.15,
            left: -size.width * 0.3,
            child: _AnimatedOrb(
              size: size.width * 0.75,
              color: AppColors.brand500.withValues(alpha: 0.08),
              duration: const Duration(seconds: 8),
            ),
          ),
          Positioned(
            bottom: -size.height * 0.1,
            right: -size.width * 0.2,
            child: _AnimatedOrb(
              size: size.width * 0.55,
              color: AppColors.indigo500.withValues(alpha: 0.06),
              duration: const Duration(seconds: 10),
            ),
          ),

          // ── Main content ──────────────────────────────
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.xl,
                  vertical: AppSpacing.xxl,
                ),
                child: ConstrainedBox(
                  // Tablet: max-width 400dp, centered
                  constraints: const BoxConstraints(maxWidth: 400),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // ── Logo ────────────────────────────
                      Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          gradient: AppColors.brandGradient,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.brand500.withValues(alpha: 0.35),
                              blurRadius: 24,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.bolt_rounded,
                          size: 30,
                          color: Colors.white,
                        ),
                      ),

                      const SizedBox(height: AppSpacing.base),

                      // ── Wordmark ────────────────────────
                      ShaderMask(
                        shaderCallback: (bounds) =>
                            AppColors.brandGradient.createShader(bounds),
                        child: Text(
                          'BizFlow',
                          style: Theme.of(context)
                              .textTheme
                              .headlineMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                                letterSpacing: -0.5,
                              ),
                        ),
                      ),

                      const SizedBox(height: AppSpacing.xs),

                      Text(
                        'Sign in to your account',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: isDark
                                  ? AppColors.darkTextSecondary
                                  : AppColors.lightTextSecondary,
                            ),
                      ),

                      const SizedBox(height: AppSpacing.xxxl),

                      // ── Login card (slide up) ────────────
                      FadeTransition(
                        opacity: _cardOpacity,
                        child: SlideTransition(
                          position: _cardSlide,
                          child: _buildLoginCard(context, isDark, authState),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoginCard(
      BuildContext context, bool isDark, AuthState authState) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.lightSurface,
        borderRadius: AppRadius.radiusXxl,
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.5 : 0.08),
            blurRadius: 50,
            offset: const Offset(0, 25),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Email ──────────────────────────────────
            AppTextField(
              controller: _emailController,
              focusNode: _emailFocus,
              label: 'Email',
              hint: 'you@company.com',
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              prefixIcon: const Icon(Icons.email_outlined, size: 18),
              onChanged: (_) => setState(() {}),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Email is required';
                if (!v.contains('@')) return 'Enter a valid email';
                return null;
              },
            ),

            const SizedBox(height: AppSpacing.base),

            // ── Password ────────────────────────────────
            AppTextField(
              controller: _passwordController,
              focusNode: _passwordFocus,
              label: 'Password',
              hint: '••••••••',
              obscureText: _obscurePassword,
              textInputAction: TextInputAction.done,
              prefixIcon: const Icon(Icons.lock_outlined, size: 18),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword
                      ? Icons.visibility_off_rounded
                      : Icons.visibility_rounded,
                  size: 18,
                  color: isDark
                      ? AppColors.darkTextMuted
                      : AppColors.lightTextMuted,
                ),
                onPressed: () =>
                    setState(() => _obscurePassword = !_obscurePassword),
              ),
              onChanged: (_) => setState(() {}),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Password is required';
                return null;
              },
            ),

            const SizedBox(height: AppSpacing.xl),

            // ── Sign in button ──────────────────────────
            AppButton(
              label: 'Sign In',
              onPressed: authState.isLoading ? null : _onLogin,
              isLoading: authState.isLoading,
              useGradient: true,
              icon: authState.isLoading ? null : Icons.login_rounded,
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
//  ANIMATED BACKGROUND ORB
// ══════════════════════════════════════════════════════

class _AnimatedOrb extends StatefulWidget {
  final double size;
  final Color color;
  final Duration duration;

  const _AnimatedOrb({
    required this.size,
    required this.color,
    required this.duration,
  });

  @override
  State<_AnimatedOrb> createState() => _AnimatedOrbState();
}

class _AnimatedOrbState extends State<_AnimatedOrb>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.duration)
      ..repeat(reverse: true);
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) => Transform.translate(
        offset: Offset(0, -28 * _anim.value),
        child: Transform.scale(
          scale: 1.0 + 0.04 * _anim.value,
          child: Container(
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: widget.color,
            ),
          ),
        ),
      ),
    );
  }
}
