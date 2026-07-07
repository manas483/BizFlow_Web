export interface BackupModelManifest {
  modelName: string;
  tableName: string; 
  businessIdField: string; 
  isTenantOwned: boolean; 
  order: number; // Topological sort order (1 = Top level, higher = depends on lower)
}

export interface BackupManifestType {
  version: string;
  models: BackupModelManifest[];
}
