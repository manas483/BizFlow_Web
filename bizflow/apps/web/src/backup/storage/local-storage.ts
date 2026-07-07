import fs from 'fs';
import path from 'path';
import { BackupStorageProvider } from './backup-storage';

export class LocalStorageProvider implements BackupStorageProvider {
  private baseDir: string;

  constructor() {
    // In production (Vercel), use /tmp to avoid EROFS error.
    // For development, we store backups in a local `.backups` directory in the project root.
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      this.baseDir = path.join('/tmp', '.backups');
    } else {
      this.baseDir = path.join(process.cwd(), '.backups');
    }
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async upload(fileName: string, data: Buffer): Promise<string> {
    const filePath = path.join(this.baseDir, fileName);
    await fs.promises.writeFile(filePath, data);
    return filePath; // return the absolute path as the URI for local storage
  }

  async download(fileName: string): Promise<Buffer> {
    const filePath = path.join(this.baseDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found in local storage: ${fileName}`);
    }
    return fs.promises.readFile(filePath);
  }

  async delete(fileName: string): Promise<void> {
    const filePath = path.join(this.baseDir, fileName);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }
}
