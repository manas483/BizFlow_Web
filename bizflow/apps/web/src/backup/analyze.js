const fs = require('fs');

const schema = fs.readFileSync('../../prisma/schema.prisma', 'utf-8');
const models = [];
let currentModel = null;

schema.split('\n').forEach(line => {
  const match = line.match(/^model\s+([a-zA-Z]+)\s+\{/);
  if (match) {
    currentModel = { name: match[1], hasBusinessId: false, relations: [] };
    models.push(currentModel);
  } else if (currentModel && line.includes('}')) {
    currentModel = null;
  } else if (currentModel) {
    if (line.includes('businessId ')) {
      currentModel.hasBusinessId = true;
    }
    const relMatch = line.match(/@relation.*references:\s*\[([^\]]+)\]/);
    if (relMatch && !line.trim().startsWith('//')) {
      const typeMatch = line.match(/^\s*[a-zA-Z]+\s+([a-zA-Z]+)[\s?]+@relation/);
      if (typeMatch) {
        currentModel.relations.push(typeMatch[1]);
      }
    }
  }
});

const tenantModels = models.filter(m => m.hasBusinessId || m.name === 'Business');

// Build adjacency list for topological sort
const adj = new Map();
const inDegree = new Map();

tenantModels.forEach(m => {
  adj.set(m.name, []);
  inDegree.set(m.name, 0);
});

tenantModels.forEach(m => {
  m.relations.forEach(rel => {
    if (adj.has(rel) && rel !== m.name) {
      adj.get(rel).push(m.name);
      inDegree.set(m.name, inDegree.get(m.name) + 1);
    }
  });
});

const queue = [];
for (let [node, deg] of inDegree.entries()) {
  if (deg === 0) queue.push(node);
}

const sorted = [];
while (queue.length > 0) {
  const node = queue.shift();
  sorted.push(node);
  
  if (adj.has(node)) {
    for (let neighbor of adj.get(node)) {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }
}

// Any missing due to cycles?
if (sorted.length !== tenantModels.length) {
  console.error("Cycle detected in dependencies!", tenantModels.length - sorted.length, "models missed.");
  // Add missing models to the end
  tenantModels.forEach(m => {
    if (!sorted.includes(m.name)) sorted.push(m.name);
  });
}

const manifestContent = `import { BackupManifestType } from '../types';

export const backupManifest: BackupManifestType = {
  version: "1.0",
  models: [
${sorted.map((name, index) => {
  const m = tenantModels.find(t => t.name === name);
  return `    {
      modelName: "${name}",
      tableName: "${name}",
      businessIdField: ${m.name === 'Business' ? '"id"' : '"businessId"'},
      isTenantOwned: true,
      order: ${index + 1}
    }`;
}).join(',\n')}
  ]
};
`;

fs.writeFileSync('manifest/backup-manifest.ts', manifestContent);
console.log("Successfully generated src/backup/manifest/backup-manifest.ts");
