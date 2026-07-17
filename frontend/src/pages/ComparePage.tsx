import React, { useState } from 'react';
import AppShell from '../components/layout/AppShell';
import {
  useStore, addCompareItem, removeCompareItem,
  addPriceModel, deletePriceModel, updatePriceModel,
  addChannelQuote, deleteChannelQuote, updateChannelQuote,
  selectBestQuote, getModelDisplayPrice, getItemDisplayPrice,
  toggleModelSync, isModelSynced,
} from '../data/store';
import { addCompareItemApi } from '../api/compare';
import { isAuthenticated } from '../api/client';
import {
  IconCompare, IconPlus, IconTrash, IconChevronDown,
  IconSearch, IconX, IconEdit, IconDownload, IconUpload,
} from '../components/common/Icons';

const ComparePage: React.FC = () => {
  const state = useStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Quick-add state (matches PurchasePage's quick-add bar)
  const [quickName, setQuickName] = useState('');
  const [quickStage, setQuickStage] = useState('0_0');
  const [quickQty, setQuickQty] = useState('1');

  // Build stage/subgroup dropdown options
  const quickStageOptions: { value: string; label: string }[] = [];
  state.purchaseReferences.forEach((stage, pi) => {
    stage.subs.forEach((sub, si) => {
      quickStageOptions.push({ value: `${pi}_${si}`, label: `${stage.parent} / ${sub.name}` });
    });
  });

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Add model state
  const [newModelName, setNewModelName] = useState('');
  const [newModelSpec, setNewModelSpec] = useState('');
  const [newModelNote, setNewModelNote] = useState('');

  // Edit model state
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editModelName, setEditModelName] = useState('');
  const [editModelSpec, setEditModelSpec] = useState('');
  const [editModelNote, setEditModelNote] = useState('');

  // Quote expand/collapse
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set());

  // Add quote state
  const [addingQuoteFor, setAddingQuoteFor] = useState<string | null>(null);
  const [newQuoteChannel, setNewQuoteChannel] = useState('');
  const [newQuotePrice, setNewQuotePrice] = useState('');
  const [newQuoteNote, setNewQuoteNote] = useState('');

  // Edit quote state
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [editQuoteChannel, setEditQuoteChannel] = useState('');
  const [editQuotePrice, setEditQuotePrice] = useState('');
  const [editQuoteNote, setEditQuoteNote] = useState('');

  const ci = state.compareItems;
  const filteredItems = searchQuery.trim()
    ? ci.filter(c => c.item_name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : ci;

  const totalModels = ci.reduce((sum, c) => sum + c.models.length, 0);
  const syncedCount = state.syncedModelIds.length;

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleQuickAdd = () => {
    if (!quickName.trim()) return;
    const [pi, si] = quickStage.split('_').map(Number);
    const stage = state.purchaseReferences[pi];
    const sub = stage?.subs[si];
    if (!stage || !sub) return;
    const qty = Math.max(1, parseInt(quickQty) || 1);
    addCompareItem(quickName.trim(), stage.parent, sub.name, qty, '', '个');
    // Sync to backend
    if (isAuthenticated()) {
      addCompareItemApi(state.activeProjectId, {
        name: quickName.trim(), stage_parent: stage.parent,
        subgroup_name: sub.name, qty, spec: '', unit: '个',
      }).catch(() => {});
    }
    setQuickName(''); setQuickQty('1');
  };

  const handleAddModel = (itemId: string) => {
    if (!newModelName.trim()) return;
    addPriceModel(itemId, newModelName.trim(), newModelSpec.trim(), newModelNote.trim(), 1);
    setNewModelName(''); setNewModelSpec(''); setNewModelNote('');
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

  const toggleQuotes = (modelId: string) => {
    setExpandedQuotes(prev => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  };

  const startEditQuote = (quote: { id: string; channel: string; price?: number; note?: string }) => {
    setEditingQuoteId(quote.id);
    setEditQuoteChannel(quote.channel);
    setEditQuotePrice(quote.price?.toString() || '');
    setEditQuoteNote(quote.note || '');
  };

  const handleEditQuote = () => {
    if (!editingQuoteId || !editQuoteChannel.trim()) return;
    updateChannelQuote(editingQuoteId, {
      channel: editQuoteChannel.trim(),
      price: editQuotePrice ? parseFloat(editQuotePrice) : undefined,
      note: editQuoteNote.trim() || undefined,
    });
    setEditingQuoteId(null);
  };

  const handleAddQuote = (modelId: string) => {
    if (!newQuoteChannel.trim()) return;
    addChannelQuote(modelId, newQuoteChannel.trim(), newQuotePrice ? parseFloat(newQuotePrice) : undefined, newQuoteNote.trim() || undefined);
    setNewQuoteChannel(''); setNewQuotePrice(''); setNewQuoteNote('');
    setAddingQuoteFor(null);
  };

  // CSV export
  const handleExportCSV = () => {
    const BOM = '﻿';
    const rows = ['物品,规格,阶段,分组,数量,型号,型号备注,渠道,价格'];
    state.compareItems.forEach(item => {
      if (item.models.length === 0) {
        rows.push(`"${item.item_name}","${item.spec || ''}","${item.stage_parent || ''}","${item.subgroup_name || ''}",${item.qty},,,--,`);
      }
      item.models.forEach(m => {
        if (m.channelQuotes.length === 0) {
          rows.push(`"${item.item_name}","${item.spec || ''}","${item.stage_parent || ''}","${item.subgroup_name || ''}",${item.qty},"${m.name}","${m.note || ''}",,--`);
        } else {
          m.channelQuotes.forEach(q => {
            rows.push(`"${item.item_name}","${item.spec || ''}","${item.stage_parent || ''}","${item.subgroup_name || ''}",${item.qty},"${m.name}","${m.note || ''}","${q.channel}",${q.price ?? ''}`);
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
      for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);
        if (fields.length < 5) continue;
        const [itemName, spec, stageName, subgroupName, qtyStr, modelName, modelNote, channel, priceStr] = fields;
        if (!itemName || !modelName) continue;
        const qty = parseInt(qtyStr) || 1;

        // Find or create item
        let existingItem = state.compareItems.find(c => c.item_name === itemName);
        if (!existingItem) {
          const [pi, si] = quickStage.split('_').map(Number);
          const stage = state.purchaseReferences[pi];
          const sub = stage?.subs[si];
          if (!stage || !sub) continue;
          const itemId = `p_import_${Date.now()}_${imported}`;
          addCompareItem(itemId, itemName, stage.parent, sub.name, qty, spec);
          existingItem = state.compareItems.find(c => c.item_id === itemId);
        }
        if (!existingItem) continue;

        addPriceModel(existingItem.item_id, modelName, spec || undefined, modelNote || undefined, 1);
        if (channel && channel !== '--') {
          const model = state.compareItems.find(c => c.item_id === existingItem!.item_id)?.models.find(m => m.name === modelName);
          if (model) {
            const price = parseFloat(priceStr) || undefined;
            addChannelQuote(model.id, channel, price);
          }
        }
        imported++;
      }
      setImportMsg({ type: 'success', text: `CSV: 导入 ${imported} 个型号` });
      setTimeout(() => setImportMsg(null), 3000);
    };
    input.click();
  };

  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
            <p>添加待购物品后，为每个物品收集不同渠道的报价进行对比。</p>
          </div>
          <div className="compare-header-stats">
            <div className="flow-stat">
              <span className="flow-stat-label">比价物品</span>
              <b className="flow-stat-value">{ci.length}</b>
            </div>
            <div className="flow-stat">
              <span className="flow-stat-label">型号数</span>
              <b className="flow-stat-value">{totalModels}</b>
            </div>
            <div className="flow-stat">
              <span className="flow-stat-label">已标记已购</span>
              <b className="flow-stat-value" style={{ color: syncedCount > 0 ? 'var(--fresh-coral)' : undefined }}>{syncedCount}</b>
            </div>
          </div>
        </div>

        {/* Quick-Add Bar — matches PurchasePage */}
        <div className="purchase-quick-add-v2">
          <input
            type="text"
            className="input"
            placeholder="直接添加比价物品，例如：冰箱"
            value={quickName}
            onChange={e => setQuickName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
            style={{ flex: 1, minWidth: 200 }}
          />
          <select
            value={quickStage}
            onChange={e => setQuickStage(e.target.value)}
            style={{ width: '100%', fontSize: 12 }}
          >
            {quickStageOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--fresh-muted)', whiteSpace: 'nowrap' }}>数量：</span>
            <input
              type="number"
              min="1"
              value={quickQty}
              onChange={e => setQuickQty(e.target.value.replace(/\D/g, '') || '1')}
              style={{ width: 56, fontSize: 12 }}
            />
          </span>
          <button className="btn btn-primary" type="button" onClick={handleQuickAdd} style={{ justifyContent: 'center' }}>添加</button>
        </div>

        {/* Search & CSV */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="compare-search">
            <IconSearch size={14} />
            <input className="input" placeholder="搜索比价物品..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft: 32, width: 240 }} />
          </div>
          <button className="btn btn-outline btn-sm" onClick={handleExportCSV}><IconDownload size={14} /> 导出 CSV</button>
          <button className="btn btn-outline btn-sm" onClick={handleImportCSV}><IconUpload size={14} /> 导入 CSV</button>
          {importMsg && <span className={`backup-msg ${importMsg.type}`} style={{ padding: '4px 10px', fontSize: 12 }}>{importMsg.text}</span>}
        </div>

        {/* Compare Items */}
        {filteredItems.length === 0 ? (
          <div className="card">
            <div className="card-bd">
              <div className="empty-state">
                <div className="empty-state-icon">⚖️</div>
                <p className="empty-state-title">
                  {searchQuery ? '未找到匹配的物品' : '暂无比价物品'}
                </p>
                <p className="empty-state-desc">
                  {searchQuery ? '尝试其他关键词' : '使用上方快速添加栏，先添加物品再进行比价'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="compare-categories">
            {(() => {
              // Group items by first-level category (stage_parent)
              const grouped = new Map<string, typeof filteredItems>();
              filteredItems.forEach(item => {
                const parent = item.stage_parent || '未分类';
                const list = grouped.get(parent) || [];
                list.push(item);
                grouped.set(parent, list);
              });
              return Array.from(grouped.entries()).map(([stageName, items]) => (
                <div key={stageName} className="compare-section">
                  <div className="compare-section-label">
                    {stageName}
                    <span className="count">{items.length} 个物品</span>
                  </div>
                  {items.map(item => {
                    const isOpen = expandedItems.has(item.item_id);
                    return (
                      <div key={item.item_id} className={`compare-cat-card card ${isOpen ? 'open' : ''}`} style={{ marginBottom: 8 }}>
                        <div
                          className="compare-cat-header"
                          onClick={() => toggleItem(item.item_id)}
                          role="button"
                          tabIndex={0}
                          aria-expanded={isOpen}
                        >
                          <div className="compare-cat-header-left">
                            <strong>{item.item_name}</strong>
                            {item.spec && <span style={{ fontSize: 12, color: '#666' }}>{item.spec}</span>}
                            <span className="badge" style={{ fontSize: 10, background: '#e8f5e9', color: '#2e7d32' }}>
                              ×{item.qty}{item.unit || '个'}
                            </span>
                          </div>
                          <div className="compare-cat-header-right">
                      {(() => { const p = getItemDisplayPrice(item.item_id); return p ? <span className="compare-cat-price">{p}</span> : null; })()}
                      {(() => {
                        const bestModelId = item.models.find(m => state.bestQuoteIds[m.id])?.id;
                        const synced = bestModelId ? isModelSynced(bestModelId) : false;
                        return (
                          <button
                            className={`btn btn-sm ${synced ? 'btn-green' : 'btn-outline'}`}
                            onClick={(e) => { e.stopPropagation(); if (bestModelId) toggleModelSync(bestModelId); }}
                            title={synced ? '已标记已购，点击取消' : bestModelId ? '标记此物品为已购' : '请先选中最优报价'}
                            style={{ fontSize: 10 }}
                            disabled={!bestModelId}
                          >
                            {synced ? '✓ 已购' : '标记已购'}
                          </button>
                        );
                      })()}
                      <button
                        className="icon-btn"
                        onClick={(e) => { e.stopPropagation(); removeCompareItem(item.item_id); }}
                        title="移出比价"
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
                      {item.models.map(model => {
                        const quotesOpen = expandedQuotes.has(model.id);
                        const displayPrice = getModelDisplayPrice(model.id);
                        return (
                        <div key={model.id} className="compare-prod-card">
                          <div className="compare-prod-hd"
                            onClick={() => toggleQuotes(model.id)}
                            role="button" tabIndex={0}
                          >
                            {editingModelId === model.id ? (
                              <div className="compare-model-info" onClick={e => e.stopPropagation()}>
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
                            <div className="compare-prod-actions">
                              {displayPrice && <span className="compare-prod-lowest">{displayPrice}</span>}
                              <span className="badge badge-default" style={{ fontSize: 10 }}>{model.channelQuotes.length} 报价</span>
                              <button className="fresh-icon-btn" onClick={() => startEditModel(model)} title="编辑" style={{ width: 22, height: 22 }}>
                                <IconEdit size={12} />
                              </button>
                              <button className="fresh-icon-btn" onClick={() => deletePriceModel(item.item_id, model.id)} title="删除" style={{ width: 22, height: 22 }}>
                                <IconTrash size={12} />
                              </button>
                              <span className={`compare-prod-arrow ${quotesOpen ? 'open' : ''}`}>
                                <IconChevronDown size={16} />
                              </span>
                            </div>
                          </div>

                          {quotesOpen && (
                            <div className="compare-prod-bd">
                              {model.channelQuotes.map(quote => {
                                const isBest = state.bestQuoteIds[model.id] === quote.id;
                                return (
                                <div key={quote.id} className={`compare-quote-row${isBest ? ' best' : ''}`}>
                                  <input
                                    type="checkbox"
                                    className="compare-quote-check"
                                    checked={state.bestQuoteIds[model.id] === quote.id}
                                    onChange={(e) => selectBestQuote(model.id, e.target.checked ? quote.id : null)}
                                    title="选为最优报价"
                                  />
                                  {editingQuoteId === quote.id ? (
                                    <div className="compare-quote-edit-row" onClick={e => e.stopPropagation()}>
                                      <input className="input" value={editQuoteChannel}
                                        onChange={e => setEditQuoteChannel(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleEditQuote()}
                                        style={{ width: 72, fontSize: 11, padding: '2px 4px' }} />
                                      <input className="input" type="number" value={editQuotePrice}
                                        onChange={e => setEditQuotePrice(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleEditQuote()}
                                        style={{ width: 80, fontSize: 11, padding: '2px 4px' }} />
                                      <input className="input" placeholder="备注" value={editQuoteNote}
                                        onChange={e => setEditQuoteNote(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleEditQuote()}
                                        style={{ flex: 1, minWidth: 60, fontSize: 11, padding: '2px 4px' }} />
                                      <button className="btn btn-primary btn-xs" onClick={handleEditQuote} style={{ fontSize: 10 }}>确定</button>
                                      <button className="btn btn-ghost btn-xs" onClick={() => setEditingQuoteId(null)} style={{ fontSize: 10 }}>取消</button>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="compare-quote-channel">{quote.channel}</span>
                                      {quote.price !== undefined && (
                                        <span className="compare-quote-price">¥{quote.price.toLocaleString()}</span>
                                      )}
                                      {quote.note && <span className="compare-quote-note">{quote.note}</span>}
                                    </>
                                  )}
                                  <div className="compare-quote-actions">
                                    {editingQuoteId !== quote.id && (
                                      <button className="fresh-icon-btn" onClick={() => startEditQuote(quote)} title="编辑报价" style={{ width: 22, height: 22 }}>
                                        <IconEdit size={11} />
                                      </button>
                                    )}
                                    <button className="fresh-icon-btn" onClick={() => deleteChannelQuote(model.id, quote.id)} title="删除报价" style={{ width: 22, height: 22 }}>
                                      <IconTrash size={12} />
                                    </button>
                                  </div>
                                </div>
                              );})}
                              {model.channelQuotes.length === 0 && (
                                <div style={{ fontSize: 11, color: 'var(--fresh-muted)', padding: '4px 0' }}>暂无报价，点击下方添加</div>
                              )}
                              <div className="compare-add-quote-row">
                                <input className="input" placeholder="渠道" value={addingQuoteFor === model.id ? newQuoteChannel : ''}
                                  onFocus={() => setAddingQuoteFor(model.id)}
                                  onChange={e => { setAddingQuoteFor(model.id); setNewQuoteChannel(e.target.value); }}
                                  style={{ width: 72, fontSize: 11, padding: '3px 6px' }} />
                                <input className="input" type="number" placeholder="价格" value={addingQuoteFor === model.id ? newQuotePrice : ''}
                                  onFocus={() => setAddingQuoteFor(model.id)}
                                  onChange={e => { setAddingQuoteFor(model.id); setNewQuotePrice(e.target.value); }}
                                  style={{ width: 80, fontSize: 11, padding: '3px 6px' }} />
                                <input className="input" placeholder="备注" value={addingQuoteFor === model.id ? newQuoteNote : ''}
                                  onFocus={() => setAddingQuoteFor(model.id)}
                                  onChange={e => { setAddingQuoteFor(model.id); setNewQuoteNote(e.target.value); }}
                                  onKeyDown={e => e.key === 'Enter' && handleAddQuote(model.id)}
                                  style={{ flex: 1, minWidth: 60, fontSize: 11, padding: '3px 6px' }} />
                                <button className="btn btn-primary btn-xs" onClick={() => handleAddQuote(model.id)} style={{ fontSize: 10, flexShrink: 0 }}>+ 报价</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );})}

                      {/* Add Model */}
                      <div className="compare-add-model-row">
                        <input className="input" placeholder="型号名称" value={newModelName}
                          onChange={e => setNewModelName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddModel(item.item_id)}
                          style={{ width: 120, fontSize: 12, padding: '4px 8px' }} />
                        <input className="input" placeholder="规格" value={newModelSpec}
                          onChange={e => setNewModelSpec(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddModel(item.item_id)}
                          style={{ width: 100, fontSize: 12, padding: '4px 8px' }} />
                        <input className="input" placeholder="备注" value={newModelNote}
                          onChange={e => setNewModelNote(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddModel(item.item_id)}
                          style={{ width: 100, fontSize: 12, padding: '4px 8px' }} />
                        <button className="btn btn-primary btn-sm" onClick={() => handleAddModel(item.item_id)} disabled={!newModelName.trim()}>
                          <IconPlus size={14} /> 添加型号
                        </button>
                      </div>
                    </div>
                  )}
                      </div>
                    );
                  })}
                  </div>
                ));
              })()}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default ComparePage;
