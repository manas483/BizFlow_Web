/// BizFlow — BrandSpinner
///
/// Gradient arc loading indicator. Replaces all CircularProgressIndicator.
library;

import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../core/theme/colors.dart';

class BrandSpinner extends StatefulWidget {
  final double size;
  final double strokeWidth;

  const BrandSpinner({
    super.key,
    this.size = 32,
    this.strokeWidth = 3,
  });

  /// Small inline spinner (20dp), e.g. inside buttons
  const BrandSpinner.small({super.key})
      : size = 20,
        strokeWidth = 2.5;

  /// Large page-level spinner (48dp)
  const BrandSpinner.large({super.key})
      : size = 48,
        strokeWidth = 4;

  @override
  State<BrandSpinner> createState() => _BrandSpinnerState();
}

class _BrandSpinnerState extends State<BrandSpinner>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => SizedBox(
        width: widget.size,
        height: widget.size,
        child: CustomPaint(
          painter: _GradientArcPainter(
            progress: _ctrl.value,
            strokeWidth: widget.strokeWidth,
          ),
        ),
      ),
    );
  }
}

class _GradientArcPainter extends CustomPainter {
  final double progress;
  final double strokeWidth;

  _GradientArcPainter({required this.progress, required this.strokeWidth});

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(
      strokeWidth / 2,
      strokeWidth / 2,
      size.width - strokeWidth,
      size.height - strokeWidth,
    );

    final gradient = SweepGradient(
      startAngle: 0,
      endAngle: math.pi * 2,
      colors: const [
        AppColors.brand300,
        AppColors.brand500,
        Colors.transparent,
      ],
      stops: const [0.0, 0.7, 1.0],
      transform: GradientRotation(math.pi * 2 * progress),
    );

    final paint = Paint()
      ..shader = gradient.createShader(rect)
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      rect,
      math.pi * 2 * progress,
      math.pi * 1.5,
      false,
      paint,
    );
  }

  @override
  bool shouldRepaint(_GradientArcPainter old) => old.progress != progress;
}
