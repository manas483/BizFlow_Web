import { BackupStorageProvider } from './backup-storage';
import { LocalStorageProvider } from './local-storage';

export function getStorageProvider(): BackupStorageProvider {
  // In a real application, you might check process.env.STORAGE_PROVIDER 
  // to return a VercelBlobStorageProvider instead of LocalStorageProvider.
  // For now, we use local storage.
  return new LocalStorageProvider();
}
