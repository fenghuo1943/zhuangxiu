import React, { useState } from 'react';
import AppShell from '../components/layout/AppShell';
import {
  useStore, addPriceCategory, deletePriceCategory,
  addPriceModel, deletePriceModel, updatePriceModel,
  deleteChannelQuote, getTotalChannelCount,
  toggleModelSync, isModelSynced,
} from '../data/store';
import {
  IconCompare, IconPlus, IconTrash, IconChevronDown,
  IconSearch, IconX, IconEdit, IconDownload, IconUpload,
} from '../components/common/Icons';

const ComparePage: React.FC = () => {
  const state = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [newCatName, setNewCatName] = useState('');

  // Add model state per category
  const [addingModelFor, setAddingModelFor] = useState<string | null>(null);
  const [newModelName, setNewModelName] = useState('');
  const [newModelSpec, setNewModelSpec] = useState('');
  const [newModelNote, setNewModelNote] = useState('');

  // Edit model state
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editModelName, setEditModelName] = useState('');
  const [editModelSpec, setEditModelSpec] = useState('');
  const [editModelNote, setEditModelNote] = useState('');

  const pc = state.priceCategories;
  const filteredCategories = searchQuery.trim()
    ? pc.filter(c => c.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : pc;

  const totalModels = pc.reduce((sum, c) => sum + c.models.length, 0);
  const totalChannels = getTotalChannelCount();
  const syncedCount = state.syncedModelIds.length;

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    addPriceCategory(newCatName.trim());
    setNewCatName('');
  };

  const handleAddModel = (catId: string) => {
    if (!newModelName.trim()) return;
    addPriceModel(catId, newModelName.trim(), newModelSpec.trim(), newModelNote.trim(), 1);
    setNewModelName(''); setNewModelSpec(''); setNewModelNote('');
    setAddingModelFor(null);
  };

  const startEditModel = (model: { id: string; name: string; spec?: string; note?: string }) => {
    setEditingModelId(model.id);
    setEditModelName(model.name);
    setEditModelSpec(model.spec || '');
    setEditModelNote(model.note || '');
  };

  const handleEditModel = () => {
    if (!editModelName.trim() || !editingModelId) return;
    updatePriceModel(editingModelId, {
      name: editModelName.trim(),
      spec: editModelSpec.trim(),
      note: editModelNote.trim(),
    });
    setEditingModelId(null);
  };

  // CSV export
  const handleExportCSV = () => {
    const BOM = '﻿';
    const rows = ['品类,型号,规格,备注,渠道,价格'];
    state.priceCategories.forEach(cat => {
      cat.models.forEach(m => {
        if (m.channelQuotes.length === 0) {
          rows.push(`"${cat.name}","${m.name}","${m.spec || ''}","${m.note || ''}",--`);
        } else {
          m.channelQuotes.forEach(q => {
            rows.push(`"${cat.name}","${m.name}","${m.spec || ''}","${m.note || ''}","${q.channel}",${q.price ?? ''}`);
          });
        }
      });
    });
    const blob = new Blob([BOM + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `比价数据_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // CSV import
  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.csv,.txt';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const clean = text.replace(/^﻿/, '');
      const lines = clean.split(/\r?\n/).filter(l => l.trim());
      let imported = 0;
      // Map: categoryName -> { models: Map<modelName, model> }
      const catMap = new Map<string, { catId: string; models: Map<string, string> }>();
      for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);
        if (fields.length < 5) continue;
        const [catName, modelName, spec, note, qtyStr, channel, priceStr] = fields;
        if (!catName || !modelName) continue;

        let entry = catMap.get(catName);
        if (!entry) {
          const existingCat = state.priceCategories.find(c => c.name === catName);
          if (!existingCat) {
            addPriceCategory(catName, '📦');
            // Re-fetch state... we'll use the just-added one
          }
          entry = { catId: existingCat?.id || '', models: new Map() };
          catMap.set(catName, entry);
        }

        if (!entry.models.has(modelName)) {
          const qty = parseInt(qtyStr) || 1;
          addPriceModel(entry.catId || catName, modelName, spec, note, qty);
          entry.models.set(modelName, 'added');
          imported++;
        }
      }
      setImportMsg({ type: 'success', text: `CSV: 导入 ${imported} 个型号` });
      setTimeout(() => setImportMsg(null), 3000);
    };
    input.click();
  };

  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // CSV line parser (reuse)
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') { if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; } else inQuotes = false; }
        else current += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { result.push(current.trim()); current = ''; }
        else current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  return (
    <AppShell currentPage="compare">
      <div className="compare-page">
        {/* Header */}
        <div className="compare-header">
          <div className="compare-header-content">
            <span className="eyebrow">
              <IconCompare size={14} /> 采购比价
            </span>
            <h1>多渠道比价，选最优方案</h1>
            <p>按品类收集不同渠道的报价，对比后同步到待购清单。</p>
          </div>
          <div className="compare-header-stats">
            <div className="flow-stat">
              <span className="flow-stat-label">品类数</span>
              <b className="flow-stat-value">{pc.length}</b>
            </div>
            <div className="flow-stat">
              <span className="flow-stat-label">型号数</span>
              <b className="flow-stat-value">{totalModels}</b>
            </div>
            <div className="flow-stat">
              <span className="flow-stat-label">报价渠道</span>
              <b className="flow-stat-value">{totalChannels}</b>
            </div>
            <div className="flow-stat">
              <span className="flow-stat-label">已同步待购</span>
              <b className="flow-stat-value" style={{ color: syncedCount > 0 ? 'var(--fresh-coral)' : undefined }}>{syncedCount}</b>
            </div>
          </div>
        </div>

        {/* Add Category */}
        <div className="compare-add-cat">
          <input
            className="input"
            placeholder="新品类名称（如：冰箱、瓷砖、木门）"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
            style={{ width: 260 }}
          />
          <button className="btn btn-primary btn-sm" onClick={handleAddCategory} disabled={!newCatName.trim()}>
            <IconPlus size={14} /> 添加品类
          </button>
        </div>

        {/* Search & CSV */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="compare-search">
            <IconSearch size={14} />
            <input className="input" placeholder="搜索品类..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft: 32, width: 240 }} />
          </div>
          <button className="btn btn-outline btn-sm" onClick={handleExportCSV}><IconDownload size={14} /> 导出 CSV</button>
          <button className="btn btn-outline btn-sm" onClick={handleImportCSV}><IconUpload size={14} /> 导入 CSV</button>
          {importMsg && <span className={`backup-msg ${importMsg.type}`} style={{ padding: '4px 10px', fontSize: 12 }}>{importMsg.text}</span>}
        </div>

        {/* Category Cards */}
        {filteredCategories.length === 0 ? (
          <div className="card">
            <div className="card-bd">
              <div className="empty-state">
                <div className="empty-state-icon">⚖️</div>
                <p className="empty-state-title">
                  {searchQuery ? '未找到匹配的品类' : '暂无比价品类'}
                </p>
                <p className="empty-state-desc">
                  {searchQuery ? '尝试其他关键词' : '添加品类开始比价，例如冰箱、瓷砖、木门等'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="compare-categories">
            {filteredCategories.map(cat => {
              const isOpen = expandedCategories.has(cat.id);
              return (
                <div key={cat.id} className={`compare-cat-card card ${isOpen ? 'open' : ''}`}>
                  <div
                    className="compare-cat-header"
                    onClick={() => toggleCategory(cat.id)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                  >
                    <div className="compare-cat-header-left">
                      <strong>{cat.name}</strong>
                      <span className="badge badge-default">{cat.models.length} 个型号</span>
                    </div>
                    <div className="compare-cat-header-right">
                      <button
                        className="icon-btn"
                        onClick={(e) => { e.stopPropagation(); deletePriceCategory(cat.id); }}
                        title="删除品类"
                      >
                        <IconTrash size={14} />
                      </button>
                      <span className={`purchase-stage-chevron ${isOpen ? 'open' : ''}`}>
                        <IconChevronDown size={18} />
                      </span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="compare-cat-body">
                      {/* Models */}
                      {cat.models.map(model => (
                        <div key={model.id} className="compare-model-row">
                          {editingModelId === model.id ? (
                            <div className="compare-model-info">
                              <input className="input" value={editModelName}
                                onChange={e => setEditModelName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleEditModel()}
                                style={{ width: 100, fontSize: 12, padding: '2px 6px' }} />
                              <input className="input" placeholder="规格" value={editModelSpec}
                                onChange={e => setEditModelSpec(e.target.value)}
                                style={{ width: 80, fontSize: 12, padding: '2px 6px' }} />
                              <input className="input" placeholder="备注" value={editModelNote}
                                onChange={e => setEditModelNote(e.target.value)}
                                style={{ width: 80, fontSize: 12, padding: '2px 6px' }} />
                              <button className="btn btn-primary btn-sm" onClick={handleEditModel} style={{ fontSize: 10 }}>确定</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditingModelId(null)} style={{ fontSize: 10 }}>取消</button>
                            </div>
                          ) : (
                            <div className="compare-model-info">
                              <span className="compare-model-name">{model.name}</span>
                              {model.spec && <span className="compare-model-spec">{model.spec}</span>}
                              {model.note && <span className="compare-model-note">{model.note}</span>}
                            </div>
                          )}
                          <div className="compare-model-quotes">
                            {model.channelQuotes.map(quote => (
                              <div key={quote.id} className="compare-quote-chip">
                                <span className="compare-quote-channel">{quote.channel}</span>
                                {quote.price !== undefined && (
                                  <span className="compare-quote-price">¥{quote.price.toLocaleString()}</span>
                                )}
                                <button
                                  className="fresh-icon-btn"
                                  onClick={() => deleteChannelQuote(model.id, quote.id)}
                                  style={{ width: 20, height: 20 }}
                                >
                                  <IconX size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            className={`btn btn-sm ${isModelSynced(model.id) ? 'btn-green' : 'btn-outline'}`}
                            onClick={() => toggleModelSync(model.id)}
                            title={isModelSynced(model.id) ? '已同步到待购，点击取消' : '同步到待购清单'}
                            style={{ flexShrink: 0, fontSize: 11 }}
                          >
                            {isModelSynced(model.id) ? '✓ 已同步' : '同步到待购'}
                          </button>
                          <button className="fresh-icon-btn" onClick={() => startEditModel(model)} title="编辑型号" style={{ flexShrink: 0 }}>
                            <IconEdit size={13} />
                          </button>
                          <button className="fresh-icon-btn" onClick={() => deletePriceModel(cat.id, model.id)} title="删除型号" style={{ flexShrink: 0 }}>
                            <IconTrash size={13} />
                          </button>
                        </div>
                      ))}

                      {/* Add Model */}
                      {addingModelFor === cat.id ? (
                        <div className="compare-add-model-row">
                          <input className="input" placeholder="型号名称" value={newModelName}
                            onChange={e => setNewModelName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddModel(cat.id)}
                            style={{ width: 120 }} />
                          <input className="input" placeholder="规格" value={newModelSpec}
                            onChange={e => setNewModelSpec(e.target.value)}
                            style={{ width: 100 }} />
                          <input className="input" placeholder="备注" value={newModelNote}
                            onChange={e => setNewModelNote(e.target.value)}
                            style={{ width: 100 }} />
                          <button className="btn btn-primary btn-sm" onClick={() => handleAddModel(cat.id)}>添加</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setAddingModelFor(null); setNewModelName(''); setNewModelSpec(''); setNewModelNote(''); }}>取消</button>
                        </div>
                      ) : (
                        <button className="btn btn-outline btn-sm" onClick={() => setAddingModelFor(cat.id)} style={{ margin: '8px 16px' }}>
                          <IconPlus size={14} /> 添加型号
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default ComparePage;
