import fs from 'fs';
import path from 'path';

function run() {
  const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const models: string[] = [];
  const dependencies: Record<string, string[]> = {};
  const EXCLUDED_MODELS = ['AuthDiagnosticLog', 'EmailVerification'];

  let currentModel: string | null = null;

  for (const line of schema.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('model ')) {
      currentModel = trimmed.split(' ')[1];
      if (!EXCLUDED_MODELS.includes(currentModel)) {
        models.push(currentModel);
        dependencies[currentModel] = [];
      } else {
        currentModel = null;
      }
    } else if (trimmed.startsWith('}') && currentModel) {
      currentModel = null;
    } else if (currentModel) {
      // Look for @relation
      const relationMatch = trimmed.match(/@relation\([^)]*references:\s*\[([^\]]+)\]/);
      if (relationMatch) {
        // Find the type of this field
        const parts = trimmed.split(/\s+/);
        const fieldType = parts[1].replace('?', '').replace('[]', '');
        
        // This means currentModel depends on fieldType
        if (!EXCLUDED_MODELS.includes(fieldType) && fieldType !== currentModel) {
          dependencies[currentModel].push(fieldType);
        }
      }
    }
  }

  // Topological Sort
  const sortedModels: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(model: string) {
    if (visited.has(model)) return;
    if (visiting.has(model)) {
      console.warn('Cycle detected involving ' + model);
      return;
    }

    visiting.add(model);
    for (const dep of (dependencies[model] || [])) {
      visit(dep);
    }
    visiting.delete(model);
    visited.add(model);
    sortedModels.push(model);
  }

  for (const model of models) {
    visit(model);
  }

  // Determine businessId fields (hardcoded the nested ones based on standard bizflow schema)
  const businessIdMap: Record<string, string> = {
    'Business': 'id',
    'BillOfSupplyItem': 'billOfSupply.businessId',
    'DeviceToken': 'user.businessId',
    'EmailVerification': 'user.businessId',
    'ExpenseAllocationHistory': 'expense.businessId',
    'InventoryLayerCost': 'layer.businessId',
    'JournalLine': 'journalEntry.businessId',
    'LoanDocument': 'loan.businessId',
    'LoanPayment': 'loan.businessId',
    'LoanSchedule': 'loan.businessId',
    'PurchaseAttachment': 'purchase.businessId',
    'PurchaseItem': 'purchase.businessId',
    'QuotationItem': 'quotation.businessId',
    'SaleItem': 'sale.businessId',
    'SalePayment': 'sale.businessId',
    'StockCountItem': 'stockCount.businessId',
    'BillOfMaterialItem': 'bom.businessId',
  };

  let out = `import { BackupManifestType } from '../types';\n\n`;
  out += `export const backupManifest: BackupManifestType = {\n`;
  out += `  version: "1.0",\n`;
  out += `  models: [\n`;

  for (let i = 0; i < sortedModels.length; i++) {
    const m = sortedModels[i];
    const bId = businessIdMap[m] || 'businessId'; // Default to businessId if not in map
    
    out += `    {\n`;
    out += `      modelName: "${m}",\n`;
    out += `      tableName: "${m}",\n`;
    out += `      businessIdField: "${bId}",\n`;
    out += `      isTenantOwned: true,\n`;
    out += `      order: ${i + 1}\n`;
    out += `    }${i < sortedModels.length - 1 ? ',' : ''}\n`;
  }

  out += `  ]\n};\n`;

  const outPath = path.join(__dirname, 'manifest', 'backup-manifest.ts');
  fs.writeFileSync(outPath, out);
  console.log(`Generated robust manifest successfully with ${sortedModels.length} models.`);
}

run();
