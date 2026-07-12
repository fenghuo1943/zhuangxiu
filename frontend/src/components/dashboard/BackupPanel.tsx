import React, { useRef, useState } from 'react';
import { Card, CardHeader, CardBody } from '../common/Card';
import { IconDownload, IconUpload, IconPlus, IconShield } from '../common/Icons';
import { exportAllData, importAllData, addProject, getState } from '../../data/store';
import { useAuth } from '../../api/useAuth';
import { pushState, pullState } from '../../api/sync';
import { importAllData as importState } from '../../data/store';

export const BackupPanel: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const { isLoggedIn } = useAuth();
  const state = getState();

  const handleExport = () => {
    const json = exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `装修手记_数据备份_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const ok = importAllData(text);
      setImportStatus(ok ? 'success' : 'error');
      setTimeout(() => setImportStatus('idle'), 3000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleNewProject = () => {
    const name = prompt('请输入新项目名称：');
    if (name?.trim()) {
      addProject(name.trim());
    }
  };

  const handleCloudUpload = async () => {
    setSyncStatus('uploading');
    try {
      await pushState(state.activeProjectId, { ...state, recentExpenses: state.expenses.slice(0, 5) } as any);
      setSyncStatus('upload_ok');
    } catch (e: any) {
      setSyncStatus('error:' + e.message);
    }
    setTimeout(() => setSyncStatus(null), 3000);
  };

  const handleCloudDownload = async () => {
    setSyncStatus('downloading');
    try {
      const data = await pullState(state.activeProjectId);
      // Merge server data into local state
      importState(JSON.stringify(data));
      setSyncStatus('download_ok');
      setTimeout(() => window.location.reload(), 500);
    } catch (e: any) {
      setSyncStatus('error:' + e.message);
    }
    setTimeout(() => setSyncStatus(null), 3000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="card-title-row">
          <span className="iconbox iconbox-coral">
            <IconShield size={16} />
          </span>
          <h3>数据管理</h3>
        </div>
      </CardHeader>
      <CardBody>
        <div className="backup-actions">
          <button className="btn btn-outline btn-sm" onClick={handleNewProject}>
            <IconPlus size={14} />
            新建项目
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleExport}>
            <IconDownload size={14} />
            导出JSON
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>
            <IconUpload size={14} />
            导入JSON
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
        </div>

        {isLoggedIn && (
          <div className="backup-actions" style={{ marginTop: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={handleCloudUpload} disabled={syncStatus === 'uploading'}>
              ☁️ {syncStatus === 'uploading' ? '上传中...' : '上传到云端'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleCloudDownload} disabled={syncStatus === 'downloading'}>
              ☁️ {syncStatus === 'downloading' ? '下载中...' : '从云端恢复'}
            </button>
          </div>
        )}

        {importStatus === 'success' && <p className="backup-msg success">✅ 数据导入成功</p>}
        {importStatus === 'error' && <p className="backup-msg error">❌ 导入失败，请检查文件格式</p>}
        {syncStatus === 'upload_ok' && <p className="backup-msg success">☁️ 已上传到云端</p>}
        {syncStatus === 'download_ok' && <p className="backup-msg success">☁️ 已从云端恢复</p>}
        {syncStatus?.startsWith('error:') && <p className="backup-msg error">❌ {syncStatus.slice(6)}</p>}
      </CardBody>
    </Card>
  );
};

export default BackupPanel;
