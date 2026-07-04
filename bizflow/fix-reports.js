const fs = require('fs');
const file = 'c:/Users/sacha/Desktop/B/bizflow/apps/web/src/app/api/reports/route.ts';
let content = fs.readFileSync(file, 'utf8');

// Insert saleDateFilter
content = content.replace(
  "    const { getCachedOrSet, CACHE_TTL } = await import('@/shared/lib/cache');",
  `    const saleDateFilter = {
      OR: [
        { invoiceDate: { gte: from, lte: to } },
        { invoiceDate: null, createdAt: { gte: from, lte: to } }
      ]
    };

    const { getCachedOrSet, CACHE_TTL } = await import('@/shared/lib/cache');`
);

// Replace sale filters
content = content.replace(/createdAt: \{ gte: from, lte: to \}/g, '...saleDateFilter');

// Replace groupBy
content = content.replace(/by: \['createdAt'\]/g, "by: ['createdAt', 'invoiceDate']");

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed reports route');
