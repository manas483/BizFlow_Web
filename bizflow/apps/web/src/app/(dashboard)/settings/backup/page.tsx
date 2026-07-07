'use client';

import React, { useState, useEffect } from 'react';
import { Shield, HardDrive, AlertTriangle, CheckCircle, Clock, Save, RefreshCw } from 'lucide-react';

interface BackupRecord {
  id: string;
  fileName: string;
  fileSize: number;
  status: string;
  createdAt: string;
}

export default function BackupDashboard() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore State
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupRecord | null>(null);
  const [restoreStep, setRestoreStep] = useState<'INITIAL' | 'DRY_RUNNING' | 'PREVIEW' | 'RESTORING' | 'SUCCESS'>('INITIAL');
  const [restorePreview, setRestorePreview] = useState<any>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/backup');
      if (!res.ok) throw new Error('Failed to fetch backups. You may not have permission.');
      const data = await res.json();
      setBackups(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Manual backup from UI' })
      });
      if (!res.ok) throw new Error('Failed to create backup');
      await fetchBackups();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleInitiateRestore = (backup: BackupRecord) => {
    setSelectedBackup(backup);
    setRestoreStep('INITIAL');
    setRestoreModalOpen(true);
    setRestoreConfirmText('');
  };

  const runDryRun = async () => {
    if (!selectedBackup) return;
    try {
      setRestoreStep('DRY_RUNNING');
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupRecordId: selectedBackup.id, dryRun: true })
      });
      if (!res.ok) throw new Error('Dry run failed. The backup may be corrupted.');
      const data = await res.json();
      setRestorePreview(data);
      setRestoreStep('PREVIEW');
    } catch (err: any) {
      alert(err.message);
      setRestoreStep('INITIAL');
    }
  };

  const runFullRestore = async () => {
    if (!selectedBackup || restoreConfirmText !== 'RESTORE') return;
    try {
      setRestoreStep('RESTORING');
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupRecordId: selectedBackup.id, dryRun: false })
      });
      if (!res.ok) throw new Error('Full restore failed.');
      setRestoreStep('SUCCESS');
    } catch (err: any) {
      alert(err.message);
      setRestoreStep('INITIAL');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-600" />
            Backup & Restore
          </h1>
          <p className="text-primary/50 mt-2">Manage disaster recovery and system snapshots.</p>
        </div>
        <button
          onClick={handleCreateBackup}
          disabled={creating}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-sm shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-70"
        >
          {creating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {creating ? 'Creating...' : 'Create Backup'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex items-center gap-3">
          <AlertTriangle className="text-red-500 w-6 h-6" />
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      )}

      <div className="bg-[#13131f] rounded-2xl border border-primary/10 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-primary/10 bg-primary/5 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-primary/40" />
            Recent Backups
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-primary/5 text-primary/50 text-sm border-b border-primary/10">
                <th className="px-6 py-4 font-medium">Backup File</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Size</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-primary/40">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 opacity-50" />
                    Loading backups...
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-primary/50 font-medium">
                    No backups found.
                  </td>
                </tr>
              ) : (
                backups.map(backup => (
                  <tr key={backup.id} className="hover:bg-primary/5 transition-colors group">
                    <td className="px-6 py-4 font-mono text-sm text-primary/70">
                      {backup.fileName}
                    </td>
                    <td className="px-6 py-4 text-sm text-primary/70 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary/40" />
                      {new Date(backup.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-primary/70">
                      {formatSize(backup.fileSize)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {backup.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleInitiateRestore(backup)}
                        className="text-indigo-600 font-medium text-sm hover:text-indigo-800 transition-opacity"
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restore Modal */}
      {restoreModalOpen && selectedBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-[#13131f] rounded-3xl shadow-xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8">
              <h3 className="text-2xl font-bold text-primary mb-2">Restore Backup</h3>
              <p className="text-primary/50 font-mono text-sm mb-8">{selectedBackup.fileName}</p>

              {restoreStep === 'INITIAL' && (
                <div className="space-y-6">
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-800 text-sm">
                    <strong>Warning:</strong> Restoring a backup will overwrite your current database. 
                    Before we restore, we will run a Dry Run to simulate the process and calculate the impact.
                  </div>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setRestoreModalOpen(false)} className="px-5 py-2.5 rounded-xl font-medium text-primary/70 hover:bg-slate-100">Cancel</button>
                    <button onClick={runDryRun} className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-medium">Run Dry Run</button>
                  </div>
                </div>
              )}

              {restoreStep === 'DRY_RUNNING' && (
                <div className="py-12 text-center">
                  <RefreshCw className="w-12 h-12 animate-spin text-indigo-500 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-primary">Simulating Restore...</h4>
                  <p className="text-primary/50 mt-2">Checking schema compatibility and data integrity.</p>
                </div>
              )}

              {restoreStep === 'PREVIEW' && restorePreview && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-emerald-800 font-bold text-base">Dry Run Successful</h4>
                      <p className="text-emerald-700 text-sm mt-1">
                        The backup is fully compatible and structurally sound.
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                      <p className="text-sm font-medium text-red-800 mb-1">Records to Delete</p>
                      <p className="text-2xl font-bold text-red-600">
                        {Object.values(restorePreview.recordsDeleted || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0)}
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                      <p className="text-sm font-medium text-green-800 mb-1">Records to Insert</p>
                      <p className="text-2xl font-bold text-green-600">
                        {Object.values(restorePreview.recordsInserted || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      Type <span className="font-bold text-red-600">RESTORE</span> to confirm permanent overwrite
                    </label>
                    <input 
                      type="text" 
                      value={restoreConfirmText}
                      onChange={(e) => setRestoreConfirmText(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-primary/20 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all font-mono"
                      placeholder="RESTORE"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setRestoreModalOpen(false)} className="px-5 py-2.5 rounded-xl font-medium text-primary/70 hover:bg-slate-100">Cancel</button>
                    <button 
                      onClick={runFullRestore} 
                      disabled={restoreConfirmText !== 'RESTORE'}
                      className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50 transition-all"
                    >
                      Permanently Restore
                    </button>
                  </div>
                </div>
              )}

              {restoreStep === 'RESTORING' && (
                <div className="py-12 text-center">
                  <RefreshCw className="w-12 h-12 animate-spin text-red-500 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-primary">Restoring Database...</h4>
                  <p className="text-primary/50 mt-2">Please do not close this tab. The operation is in progress.</p>
                </div>
              )}

              {restoreStep === 'SUCCESS' && (
                <div className="py-8 text-center animate-in zoom-in-95">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <h4 className="text-2xl font-bold text-primary mb-2">Restore Complete</h4>
                  <p className="text-primary/50 mb-8">The database has been successfully restored.</p>
                  <button 
                    onClick={() => {
                      setRestoreModalOpen(false);
                      window.location.reload(); // Reload to fetch fresh data globally
                    }} 
                    className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-medium"
                  >
                    Refresh Dashboard
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
