const fs = require('fs');

const file = 'c:\\Users\\sacha\\Desktop\\B\\bizflow\\apps\\web\\src\\app\\api\\sales\\[id]\\route.ts';
let content = fs.readFileSync(file, 'utf8');

// We'll update the DELETE logic first.
content = content.replace(
  `    await prisma.$transaction(async (tx: any) => {
      // Restore stock for each sale item
      for (const item of existing.items) {`,
  `    await prisma.$transaction(async (tx: any) => {
      if (existing.workflowState !== 'draft') {
        // Restore stock for each sale item
        for (const item of existing.items) {`
);

content = content.replace(
  `      // Delete sale items first, then sale
      await tx.saleItem.deleteMany({ where: { saleId: id } });
      await tx.sale.delete({ where: { id } });
    });`,
  `      }
      
      // Delete sale items first, then sale (for both drafts and posted)
      await tx.saleItem.deleteMany({ where: { saleId: id } });
      await tx.sale.delete({ where: { id } });
    });`
);

fs.writeFileSync(file, content);
