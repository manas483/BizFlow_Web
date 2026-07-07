import { Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Models that we shouldn't backup because they are system/auth level 
// and don't belong to a tenant
const EXCLUDED_MODELS = ['AuthDiagnosticLog']; 

function run() {
  const models = Prisma.dmmf.datamodel.models;
  const adjList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const model of models) {
    if (EXCLUDED_MODELS.includes(model.name)) continue;
    adjList.set(model.name, []);
    inDegree.set(model.name, 0);
  }

  // Build graph
  for (const model of models) {
    if (EXCLUDED_MODELS.includes(model.name)) continue;
    
    for (const field of model.fields) {
      if (field.kind === 'object' && field.relationName && !field.isList) {
        // This is a relation to another model.
        // If it's the side that holds the foreign key (has relationFromFields), it depends on the target.
        if (field.relationFromFields && field.relationFromFields.length > 0) {
          const targetModel = field.type;
          if (EXCLUDED_MODELS.includes(targetModel)) continue;
          
          // model depends on targetModel -> targetModel must be created BEFORE model
          // So edge is targetModel -> model
          adjList.get(targetModel)!.push(model.name);
          inDegree.set(model.name, inDegree.get(model.name)! + 1);
        }
      }
    }
  }

  // Topological sort (Kahn's algorithm)
  const queue: string[] = [];
  for (const [model, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(model);
    }
  }

  const sortedModels: string[] = [];
  while (queue.length > 0) {
    // To ensure stability, sort queue alphabetically before popping
    queue.sort();
    const curr = queue.shift()!;
    sortedModels.push(curr);

    for (const neighbor of adjList.get(curr)!) {
      inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (sortedModels.length !== adjList.size) {
    console.error("Cycle detected in Prisma schema!");
    return;
  }

  // Determine businessIdField for each model
  // If it has businessId directly, use that.
  // Otherwise, traverse relations to find a path.
  const businessIdPaths = new Map<string, string>();
  
  for (const modelName of sortedModels) {
    if (modelName === 'Business') {
      businessIdPaths.set(modelName, 'id');
      continue;
    }
    
    const model = models.find(m => m.name === modelName)!;
    if (model.fields.some(f => f.name === 'businessId')) {
      businessIdPaths.set(modelName, 'businessId');
      continue;
    }

    // It doesn't have businessId directly. Find a mandatory relation to a model that has it.
    let foundPath = false;
    for (const field of model.fields) {
      if (field.kind === 'object' && !field.isList && field.relationFromFields?.length) {
        const parentModel = field.type;
        const parentPath = businessIdPaths.get(parentModel);
        if (parentPath && parentPath !== 'id') {
           // E.g. parent is Sale (has businessId). Path becomes sale.businessId
           businessIdPaths.set(modelName, `${field.name}.${parentPath}`);
           foundPath = true;
           break;
        } else if (parentPath === 'id' && parentModel === 'Business') {
           businessIdPaths.set(modelName, `${field.name}.id`);
           foundPath = true;
           break;
        }
      }
    }

    if (!foundPath) {
      console.warn(`Warning: Could not find businessId path for ${modelName}`);
      businessIdPaths.set(modelName, 'unknown');
    }
  }

  // Output the manifest
  let out = `import { BackupManifestType } from '../types';\n\n`;
  out += `export const backupManifest: BackupManifestType = {\n`;
  out += `  version: "1.0",\n`;
  out += `  models: [\n`;

  for (let i = 0; i < sortedModels.length; i++) {
    const m = sortedModels[i];
    out += `    {\n`;
    out += `      modelName: "${m}",\n`;
    out += `      tableName: "${m}",\n`;
    out += `      businessIdField: "${businessIdPaths.get(m)}",\n`;
    out += `      isTenantOwned: true,\n`;
    out += `      order: ${i + 1}\n`;
    out += `    }${i < sortedModels.length - 1 ? ',' : ''}\n`;
  }

  out += `  ]\n};\n`;

  const outPath = path.join(__dirname, 'manifest', 'backup-manifest.ts');
  fs.writeFileSync(outPath, out);
  console.log(`Generated manifest successfully with ${sortedModels.length} models.`);
}

run();
