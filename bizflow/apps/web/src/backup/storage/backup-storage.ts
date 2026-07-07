export interface BackupStorageProvider {
  /**
   * Uploads a backup file and returns its URI or path.
   */
  upload(fileName: string, data: Buffer): Promise<string>;
  
  /**
   * Downloads a backup file.
   */
  download(fileName: string): Promise<Buffer>;
  
  /**
   * Deletes a backup file.
   */
  delete(fileName: string): Promise<void>;
}
