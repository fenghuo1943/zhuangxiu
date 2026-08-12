import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import AppShell from '../components/layout/AppShell';
import { EmptyState } from '../components/common';
import { IconPlus, IconSearch, IconX, IconTrash, IconBook, IconImage } from '../components/common/Icons';
import { useAuth } from '../api/useAuth';
import { fetchTips, createTip, updateTip, deleteTip, uploadTipImage } from '../api/tips';
import type { Tip, TipStatus } from '../data/types';
import { ROOM_PRESETS, TIP_STATUS_META, TIP_STATUS_OPTIONS } from '../data/tipsPresets';

const TIPS_BANNER = 'tips';

const TipsPage: React.FC = () => {
  const { isLoggedIn, loading: authLoading } = useAuth();

  // ---- Data ----
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Filters ----
  const [filterRoom, setFilterRoom] = useState('');
  const [filterStatus, setFilterStatus] = useState<TipStatus | ''>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ---- Modal ----
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formRoom, setFormRoom] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formStatus, setFormStatus] = useState<TipStatus>('pending');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadTips = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchTips({
        room: filterRoom || undefined,
        status: filterStatus || undefined,
        q: debouncedSearch || undefined,
      });
      setTips(list);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, filterRoom, filterStatus, debouncedSearch]);

  useEffect(() => {
    loadTips();
  }, [loadTips]);

  // Custom rooms: rooms present in data but not in presets
  const customRooms = useMemo(() => {
    const seen = new Set(ROOM_PRESETS);
    const rooms: string[] = [];
    tips.forEach(t => {
      const room = t.room.trim();
      if (room && !seen.has(room) && !rooms.includes(room)) rooms.push(room);
    });
    return rooms;
  }, [tips]);

  // ---- Modal actions ----
  const openAddModal = () => {
    setEditingId(null);
    setFormTitle('');
    setFormRoom('');
    setFormContent('');
    setFormStatus('pending');
    setFormImages([]);
    setSaveError(null);
    setModalOpen(true);
  };

  const openEditModal = (tip: Tip) => {
    setEditingId(tip.id);
    setFormTitle(tip.title);
    setFormRoom(tip.room);
    setFormContent(tip.content || '');
    setFormStatus(tip.status);
    setFormImages(tip.images || []);
    setSaveError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formRoom.trim()) return;
    setSaveError(null);
    const payload = {
      title: formTitle.trim(),
      room: formRoom.trim(),
      content: formContent,
      status: formStatus,
      images: formImages,
    };
    try {
      if (editingId) {
        await updateTip(editingId, payload);
      } else {
        await createTip(payload);
      }
      closeModal();
      loadTips();
    } catch (e: any) {
      setSaveError(e.message || '保存失败');
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    if (!window.confirm('确定删除这条技巧吗？')) return;
    try {
      await deleteTip(editingId);
      closeModal();
      loadTips();
    } catch (e: any) {
      setSaveError(e.message || '删除失败');
    }
  };

  // ---- Image upload ----
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    setSaveError(null);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const res = await uploadTipImage(file);
        urls.push(res.url);
      }
      setFormImages(prev => [...prev, ...urls]);
    } catch (err: any) {
      setSaveError(err.message || '图片上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (url: string) => {
    setFormImages(prev => prev.filter(u => u !== url));
  };

  // ---- Unauthenticated state ----
  if (!authLoading && !isLoggedIn) {
    return (
      <AppShell currentPage={TIPS_BANNER}>
        <EmptyState
          icon="🔒"
          title="登录后使用装修技巧"
          description="技巧是个人知识库，登录后即可记录和查看。"
          action={
            <a className="btn btn-primary" href="/login">去登录</a>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell currentPage={TIPS_BANNER}>
      <div className="tips-page">
        {/* Toolbar */}
        <div className="tips-toolbar">
          <div className="tips-toolbar-top">
            <h2 className="tips-title">
              <span className="iconbox iconbox-green"><IconBook size={16} /></span>
              装修技巧
            </h2>
            <button className="btn btn-primary btn-sm" onClick={openAddModal}>
              <IconPlus size={16} /> 新增技巧
            </button>
          </div>

          <div className="tips-filter-row">
            <div className="tips-search">
              <IconSearch size={16} />
              <input
                name="tipsSearch"
                className="tips-search-input"
                placeholder="搜索技巧关键词…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              name="tipsFilterStatus"
              className="input tips-status-select"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as TipStatus | '')}
              title="按采纳状态筛选"
            >
              <option value="">全部状态</option>
              {TIP_STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="tips-chips">
            <button
              className={`chip ${filterRoom === '' ? 'active' : ''}`}
              onClick={() => setFilterRoom('')}
            >
              全部
            </button>
            {ROOM_PRESETS.map(room => (
              <button
                key={room}
                className={`chip ${filterRoom === room ? 'active' : ''}`}
                onClick={() => setFilterRoom(prev => (prev === room ? '' : room))}
              >
                {room}
              </button>
            ))}
            {customRooms.map(room => (
              <button
                key={room}
                className={`chip chip-custom ${filterRoom === room ? 'active' : ''}`}
                onClick={() => setFilterRoom(prev => (prev === room ? '' : room))}
              >
                {room}
              </button>
            ))}
          </div>
        </div>

        {/* Error banner */}
        {error && <div className="tips-error">{error}</div>}

        {/* List */}
        {loading ? (
          <div className="tips-loading">加载中…</div>
        ) : tips.length === 0 ? (
          <EmptyState
            icon="💡"
            title="还没有技巧"
            description={debouncedSearch || filterRoom || filterStatus
              ? '没有符合当前筛选条件的技巧，试试换个筛选。'
              : '点右上角「新增技巧」开始记录你的装修经验。'}
            action={
              <button className="btn btn-primary btn-sm" onClick={openAddModal}>
                <IconPlus size={16} /> 新增技巧
              </button>
            }
          />
        ) : (
          <div className="tips-list">
            {tips.map(tip => {
              const meta = TIP_STATUS_META[tip.status];
              return (
                <div key={tip.id} className="tip-card" onClick={() => openEditModal(tip)}>
                  {tip.images && tip.images.length > 0 && (
                    <div className="tip-card-thumb">
                      <img src={tip.images[0]} alt={tip.title} loading="lazy" />
                    </div>
                  )}
                  <div className="tip-card-body">
                    <div className="tip-card-top">
                      <h4 className="tip-card-title">{tip.title}</h4>
                      <span className={`tip-status-tag tip-status-${meta.color}`}>{meta.label}</span>
                    </div>
                    <p className="tip-card-content">{tip.content}</p>
                    <div className="tip-card-foot">
                      <span className="tip-room-tag">{tip.room}</span>
                      <span className="tip-card-date">
                        {new Date(tip.created_at).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <IconBook size={18} />
                {editingId ? '编辑技巧' : '新增技巧'}
              </h3>
              <button className="icon-btn" onClick={closeModal}>
                <IconX size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>技巧标题 *</label>
                <input
                  name="tipTitle"
                  className="input"
                  style={{ width: '100%' }}
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="例如：衣柜挂衣杆朝里挪 3~4cm"
                />
              </div>
              <div className="form-group">
                <label>所属房间 *</label>
                <input
                  name="tipRoom"
                  className="input"
                  style={{ width: '100%' }}
                  list="tips-room-options"
                  value={formRoom}
                  onChange={e => setFormRoom(e.target.value)}
                  placeholder="选择或输入房间名，如：厨房"
                />
                <datalist id="tips-room-options">
                  {ROOM_PRESETS.map(room => <option key={room} value={room} />)}
                </datalist>
                <div className="tips-form-chips">
                  {ROOM_PRESETS.slice(0, 5).map(room => (
                    <button
                      key={room}
                      type="button"
                      className={`chip ${formRoom === room ? 'active' : ''}`}
                      onClick={() => setFormRoom(room)}
                    >
                      {room}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>详情（来源可写在这里）</label>
                <textarea
                  name="tipContent"
                  className="input tips-content-input"
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  placeholder="记录具体做法、注意事项，以及是从哪里学到的（小红书/装修公司/朋友…）"
                  rows={4}
                />
              </div>
              <div className="form-group">
                <label>采纳状态</label>
                <select
                  name="tipStatus"
                  className="input"
                  style={{ width: '100%' }}
                  value={formStatus}
                  onChange={e => setFormStatus(e.target.value as TipStatus)}
                >
                  {TIP_STATUS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>图片（可选）</label>
                <div className="tips-form-images">
                  {formImages.map(url => (
                    <div key={url} className="tips-img-item">
                      <img src={url} alt="" />
                      <button
                        type="button"
                        className="tips-img-remove"
                        onClick={() => removeImage(url)}
                        title="删除图片"
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  ))}
                  <label className="tips-img-add">
                    <IconImage size={20} />
                    <span>{uploading ? '上传中…' : '添加图片'}</span>
                    <input
                      ref={fileInputRef}
                      name="tipImage"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>
              {saveError && <div className="tips-error">{saveError}</div>}
            </div>
            <div className="modal-footer">
              {editingId && (
                <button className="btn btn-danger btn-sm" onClick={handleDelete}>
                  <IconTrash size={16} /> 删除
                </button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" onClick={closeModal}>取消</button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={!formTitle.trim() || !formRoom.trim() || uploading}
                >
                  {editingId ? '保存修改' : '确认添加'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default TipsPage;
