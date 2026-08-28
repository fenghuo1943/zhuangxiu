import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import AppShell from '../components/layout/AppShell';
import { EmptyState } from '../components/common';
import { IconPlus, IconSearch, IconX, IconDiary, IconImage, IconEdit, IconTrash } from '../components/common/Icons';
import { useAuth } from '../api/useAuth';
import { useStore } from '../data/store';
import { fetchDiaries, fetchDiariesCount, createDiary, updateDiary, deleteDiary, uploadDiaryImage, cleanupUploadedDiaryImages, cleanupUnusedImages } from '../api/diaries';
import type { Diary } from '../data/types';

const DIARY_BANNER = 'diary';

const DiaryPage: React.FC = () => {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const { activeProjectId, purchaseReferences } = useStore();

  // ---- Data ----
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Filters ----
  const [filterStage, setFilterStage] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ---- Modal ----
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStage, setFormStage] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ---- Image Preview ----
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  // ---- Toast ----
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 3000);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingDraftImageUrlsRef = useRef<string[]>([]);

  // 获取阶段选项
  const stageOptions = useMemo(() => {
    const seen = new Set<string>();
    const stages: string[] = [];
    purchaseReferences.forEach(ref => {
      if (ref.parent && !seen.has(ref.parent)) {
        seen.add(ref.parent);
        stages.push(ref.parent);
      }
    });
    return stages;
  }, [purchaseReferences]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadDiaries = useCallback(async () => {
    if (!isLoggedIn || !activeProjectId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchDiaries(activeProjectId, {
        stage_parent: filterStage || undefined,
        q: debouncedSearch || undefined,
      });
      setDiaries(list);
      // 获取总数
      const countRes = await fetchDiariesCount(activeProjectId);
      setTotalCount(countRes.count);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, activeProjectId, filterStage, debouncedSearch]);

  useEffect(() => {
    loadDiaries();
  }, [loadDiaries]);

  // ---- Modal actions ----
  const cleanupPendingDraftImages = useCallback(async () => {
    const pendingUrls = [...pendingDraftImageUrlsRef.current];
    pendingDraftImageUrlsRef.current = [];
    if (pendingUrls.length === 0) return;
    try {
      await cleanupUploadedDiaryImages(pendingUrls);
    } catch (err) {
      console.warn('清理未保存的日记图片失败:', err);
    }
  }, []);

  const openAddModal = () => {
    pendingDraftImageUrlsRef.current = [];
    setEditingId(null);
    setFormTitle('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormStage(stageOptions[0] || '');
    setFormContent('');
    setFormImages([]);
    setSaveError(null);
    setModalOpen(true);
  };

  const openEditModal = (diary: Diary) => {
    pendingDraftImageUrlsRef.current = [];
    setEditingId(diary.id);
    setFormTitle(diary.title);
    setFormDate(diary.date);
    setFormStage(diary.stage_parent);
    setFormContent(diary.content || '');
    setFormImages(diary.images || []);
    setSaveError(null);
    setModalOpen(true);
  };

  const closeModal = async () => {
    setModalOpen(false);
    setEditingId(null);
    setSaveError(null);
    await cleanupPendingDraftImages();
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formDate || !formStage || !activeProjectId) return;
    setSaving(true);
    setSaveError(null);
    const payload = {
      title: formTitle.trim(),
      date: formDate,
      stage_parent: formStage,
      content: formContent,
      images: formImages,
    };
    try {
      if (editingId) {
        await updateDiary(activeProjectId, editingId, payload);
      } else {
        await createDiary(activeProjectId, payload);
      }
      pendingDraftImageUrlsRef.current = [];
      closeModal();
      loadDiaries();
    } catch (e: any) {
      setSaveError(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId || !activeProjectId) return;
    if (!window.confirm('确定删除这篇日记吗？')) return;
    try {
      await deleteDiary(activeProjectId, editingId);
      closeModal();
      loadDiaries();
    } catch (e: any) {
      setSaveError(e.message || '删除失败');
    }
  };

  // ---- Cleanup unused images ----
  const handleCleanupImages = async () => {
    if (!window.confirm('确定清理未使用的图片资源？此操作不可恢复。')) return;
    try {
      const result = await cleanupUnusedImages();
      showToast(result.message);
    } catch (e: any) {
      showToast(e.message || '清理失败');
    }
  };

  // ---- Image upload ----
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (formImages.length + files.length > 9) {
      setSaveError('最多上传9张图片');
      return;
    }
    setUploading(true);
    setSaveError(null);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const res = await uploadDiaryImage(file);
        urls.push(res.url);
      }
      setFormImages(prev => [...prev, ...urls]);
      pendingDraftImageUrlsRef.current = [...pendingDraftImageUrlsRef.current, ...urls];
    } catch (err: any) {
      setSaveError(err.message || '图片上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (url: string) => {
    setFormImages(prev => prev.filter(u => u !== url));
    pendingDraftImageUrlsRef.current = pendingDraftImageUrlsRef.current.filter(u => u !== url);
  };

  // ---- Unauthenticated state ----
  if (!authLoading && !isLoggedIn) {
    return (
      <AppShell currentPage={DIARY_BANNER}>
        <EmptyState
          icon="🔒"
          title="登录后使用装修日记"
          description="登录后即可记录装修过程中的点点滴滴。"
          action={
            <a className="btn btn-primary" href="/login">去登录</a>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell currentPage={DIARY_BANNER}>
      <div className="diary-page">
        {/* Header */}
        <div className="diary-header">
          <div className="diary-header-left">
            <h2 className="diary-title">
              <span className="iconbox iconbox-orange"><IconDiary size={16} /></span>
              装修日记
            </h2>
            <span className="diary-count">共 {totalCount} 篇</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={handleCleanupImages}>
              清理未用图片
            </button>
            <button className="btn btn-primary btn-sm" onClick={openAddModal}>
              <IconPlus size={16} /> 写日记
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="diary-filter-row">
          <div className="diary-search">
            <IconSearch size={16} />
            <input
              name="diarySearch"
              className="diary-search-input"
              placeholder="搜索日记标题或内容……"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            name="diaryFilterStage"
            className="input diary-stage-select"
            value={filterStage}
            onChange={e => setFilterStage(e.target.value)}
            title="按装修阶段筛选"
          >
            <option value="">全部装修阶段</option>
            {stageOptions.map(stage => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>
        </div>

        {/* Error banner */}
        {error && <div className="diary-error">{error}</div>}

        {/* List */}
        {loading ? (
          <div className="diary-loading">加载中…</div>
        ) : diaries.length === 0 ? (
          <EmptyState
            icon="📝"
            title={debouncedSearch || filterStage ? '暂无符合条件的日记' : '还没有装修日记'}
            description={debouncedSearch || filterStage
              ? '没有符合当前筛选条件的日记，试试清除筛选。'
              : '记录下今天的装修进展吧。'}
            action={
              debouncedSearch || filterStage ? (
                <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setFilterStage(''); }}>
                  清除筛选
                </button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={openAddModal}>
                  <IconPlus size={16} /> 写第一篇日记
                </button>
              )
            }
          />
        ) : (
          <div className="diary-list">
            {diaries.map(diary => (
              <div key={diary.id} className="diary-card" onClick={() => openEditModal(diary)}>
                <div className="diary-card-header">
                  <span className="diary-card-date">
                    {new Date(diary.date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <span className="diary-card-stage">{diary.stage_parent}</span>
                </div>
                <h4 className="diary-card-title">{diary.title}</h4>
                <p className="diary-card-content">
                  {diary.content || '暂无文字内容'}
                </p>
                <div className="diary-card-footer">
                  {diary.images && diary.images.length > 0 && (
                    <span className="diary-card-images">
                      <IconImage size={14} /> {diary.images.length}张图片
                    </span>
                  )}
                  <div className="diary-card-actions">
                    <button
                      className="icon-btn"
                      onClick={(e) => { e.stopPropagation(); openEditModal(diary); }}
                      title="编辑"
                    >
                      <IconEdit size={16} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={(e) => { e.stopPropagation(); setEditingId(diary.id); handleDelete(); }}
                      title="删除"
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                </div>
                {diary.images && diary.images.length > 0 && (
                  <div className="diary-card-images-grid">
                    {diary.images.map((img, idx) => (
                      <div key={idx} className="diary-card-image-item" onClick={(e) => { e.stopPropagation(); setPreviewImages(diary.images || []); setPreviewIndex(idx); }}>
                        <img src={img} alt={`${diary.title} - ${idx + 1}`} loading="lazy" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal diary-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <IconDiary size={18} />
                {editingId ? '编辑日记' : '写日记'}
              </h3>
              <button className="icon-btn" onClick={closeModal}>
                <IconX size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>标题 *</label>
                <input
                  name="diaryTitle"
                  className="input"
                  style={{ width: '100%' }}
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="例如：水电验收记录"
                  maxLength={200}
                />
              </div>
              <div className="form-group">
                <label>日期 *</label>
                <input
                  name="diaryDate"
                  className="input"
                  type="date"
                  style={{ width: '100%' }}
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>装修阶段 *</label>
                <select
                  name="diaryStage"
                  className="input"
                  style={{ width: '100%' }}
                  value={formStage}
                  onChange={e => setFormStage(e.target.value)}
                >
                  {stageOptions.map(stage => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>内容</label>
                <textarea
                  name="diaryContent"
                  className="input diary-content-input"
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  placeholder="记录施工进度、问题、验收结果或心得……"
                  rows={6}
                  maxLength={10000}
                />
              </div>
              <div className="form-group">
                <label>图片（最多9张）</label>
                <div className="diary-form-images">
                  {formImages.map((url, idx) => (
                    <div key={url} className="diary-img-item">
                      <img src={url} alt={`图片${idx + 1}`} />
                      <button
                        type="button"
                        className="diary-img-remove"
                        onClick={() => removeImage(url)}
                        title={`删除图片${idx + 1}`}
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  ))}
                  {formImages.length < 9 && (
                    <label className="diary-img-add">
                      <span>{uploading ? '上传中…' : '添加图片'}</span>
                      <input
                        ref={fileInputRef}
                        name="diaryImage"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={handleFileChange}
                        disabled={uploading}
                      />
                    </label>
                  )}
                </div>
              </div>
              {saveError && <div className="diary-error">{saveError}</div>}
            </div>
            <div className="modal-footer">
              {editingId && (
                <button className="btn btn-danger btn-sm" onClick={handleDelete}>
                  <IconTrash size={16} /> 删除日记
                </button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" onClick={closeModal}>关闭</button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={!formTitle.trim() || !formDate || !formStage || uploading || saving}
                >
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImages.length > 0 && (
        <div className="diary-preview-overlay" onClick={() => setPreviewImages([])}>
          <button className="diary-preview-close" onClick={() => setPreviewImages([])}>
            <IconX size={24} />
          </button>
          <div className="diary-preview-content" onClick={e => e.stopPropagation()}>
            <img src={previewImages[previewIndex]} alt="预览图片" />
            {previewImages.length > 1 && (
              <>
                {previewIndex > 0 && (
                  <button className="diary-preview-nav diary-preview-prev" onClick={() => setPreviewIndex(previewIndex - 1)}>
                    ‹
                  </button>
                )}
                {previewIndex < previewImages.length - 1 && (
                  <button className="diary-preview-nav diary-preview-next" onClick={() => setPreviewIndex(previewIndex + 1)}>
                    ›
                  </button>
                )}
                <div className="diary-preview-counter">{previewIndex + 1} / {previewImages.length}</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toastVisible && (
        <div className="toast success">{toastMsg}</div>
      )}
    </AppShell>
  );
};

export default DiaryPage;
