/**
 * Shared date-range parser for all /api/v1/reports/* sub-routes.
 * Accepts: period=daily|weekly|monthly|yearly|lifetime|custom
 *          startDate, endDate (for custom)
 *          year, month (legacy compatibility)
 */

export function parseDateRange(sp: URLSearchParams): { from: Date; to: Date; period: string } {
  const period       = sp.get('period') ?? 'monthly';
  const startDateP   = sp.get('startDate');
  const endDateP     = sp.get('endDate');
  const yearP        = sp.get('year');
  const monthP       = sp.get('month');
  const now          = new Date();

  let from: Date, to: Date;

  // Legacy year/month support
  if (yearP && !sp.has('period')) {
    const year = parseInt(yearP);
    if (monthP) {
      from = new Date(year, parseInt(monthP) - 1, 1);
      to   = new Date(year, parseInt(monthP), 0, 23, 59, 59, 999);
    } else {
      from = new Date(year, 0, 1);
      to   = new Date(year, 11, 31, 23, 59, 59, 999);
    }
    return { from, to, period: 'custom' };
  }

  switch (period) {
    case 'daily':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      to   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;
    case 'weekly': {
      const day = now.getDay() || 7;
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      to   = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6, 23, 59, 59, 999);
      break;
    }
    case 'yearly':
      from = new Date(now.getFullYear(), 0, 1);
      to   = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    case 'lifetime':
      from = new Date(2000, 0, 1);
      to   = new Date(2099, 11, 31, 23, 59, 59, 999);
      break;
    case 'custom':
      if (!startDateP || !endDateP) throw new Error('startDate and endDate required for custom period');
      from = new Date(startDateP);
      to   = new Date(endDateP);
      to.setHours(23, 59, 59, 999);
      break;
    default: // monthly
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return { from, to, period };
}
