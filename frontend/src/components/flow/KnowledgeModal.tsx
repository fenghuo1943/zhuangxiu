import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import type { FlowResource, KnowledgeArticle } from '../../data/types';
import { fetchArticle, createArticle, updateArticle, deleteArticle, uploadImage } from '../../api/knowledge';
import { isAuthenticated } from '../../api/client';
import { IconX, IconEdit, IconCheck, IconImage, IconShield, IconStar, IconBook, IconAlert, IconTrash } from '../common/Icons';

interface KnowledgeModalProps {
  resource: FlowResource;
  onClose: () => void;
}

const resourceLabel: Record<string, string> = {
  standard: '施工标准',
  acceptance: '验收标准',
  article: '攻略文章',
  pitfall: '避坑指南',
};

const resourceBadgeClass: Record<string, string> = {
  standard: 'badge-success',
  acceptance: 'badge-info',
  article: 'badge-warning',
  pitfall: 'badge-danger',
};

const resourceIcon: Record<string, React.ReactNode> = {
  standard: <IconBook size={14} />,
  acceptance: <IconShield size={14} />,
  article: <IconStar size={14} />,
  pitfall: <IconAlert size={14} />,
};

const KnowledgeModal: React.FC<KnowledgeModalProps> = ({ resource, onClose }) => {
  const [mode, setMode] = useState<'loading' | 'view' | 'edit'>('loading');
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [title, setTitle] = useState(resource.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      ImageExtension,
    ],
    content: '',
    editable: false,
  });

  // Load article on mount
  useEffect(() => {
    if (!isAuthenticated()) {
      setMode('edit');
      editor?.setEditable(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const art = await fetchArticle(resource.id);
        if (cancelled) return;
        setArticle(art);
        setTitle(art.title || resource.title);
        editor?.commands.setContent(art.content || '');
        editor?.setEditable(false);
        setMode('view');
      } catch (err: any) {
        if (cancelled) return;
        if (err.message?.includes('404') || err.message?.includes('文章不存在')) {
          setMode('edit');
          editor?.commands.setContent('<p>点击此处开始编写内容…</p>');
          editor?.setEditable(true);
        } else {
          setError(err.message || '加载失败');
          setMode('edit');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [resource.id]);

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const switchToEdit = useCallback(() => {
    setMode('edit');
    editor?.setEditable(true);
    editor?.commands.focus();
  }, [editor]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadImage(file);
      editor?.chain().focus().setImage({ src: result.url }).run();
    } catch (err: any) {
      alert('图片上传失败: ' + (err.message || '未知错误'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [editor]);

  const handleSave = useCallback(async () => {
    if (!editor) return;
    const content = editor.getHTML();
    setSaving(true);
    setError(null);

    try {
      if (article) {
        const updated = await updateArticle(resource.id, { title, content });
        setArticle(updated);
      } else {
        const created = await createArticle(resource.id, {
          resource_id: resource.id,
          title,
          content,
        });
        setArticle(created);
      }
      setMode('view');
      editor.setEditable(false);
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [editor, article, resource.id, title]);

  const handleCancel = useCallback(() => {
    if (article) {
      // Revert to saved content
      setTitle(article.title || resource.title);
      editor?.commands.setContent(article.content || '');
      editor?.setEditable(false);
      setMode('view');
      setError(null);
    } else {
      onClose();
    }
  }, [article, editor, onClose, resource.title]);

  const handleDelete = useCallback(async () => {
    if (!confirm('确定要删除这篇文章吗？文章中的图片也会一并删除。')) return;
    try {
      await deleteArticle(resource.id);
      setArticle(null);
      onClose();
    } catch (err: any) {
      alert('删除失败: ' + (err.message || '未知错误'));
    }
  }, [resource.id, onClose]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!editor) return null;

  const badgeClass = resourceBadgeClass[resource.type] || 'badge-default';

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal knowledge-editor-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h3>
            <span className={`badge ${badgeClass}`} style={{ marginRight: 8 }}>
              {resourceIcon[resource.type]} {resourceLabel[resource.type] || resource.type}
            </span>
            {article?.title || title || resource.title}
          </h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {mode === 'view' && isAuthenticated() && (
              <>
                <button className="btn btn-outline btn-sm" onClick={switchToEdit}>
                  <IconEdit size={14} /> 编辑
                </button>
                <button className="btn btn-outline btn-sm" onClick={handleDelete} style={{ color: 'var(--fresh-coral)', borderColor: 'var(--fresh-coral)' }}>
                  <IconTrash size={14} /> 删除
                </button>
              </>
            )}
            <button className="icon-btn" onClick={onClose} aria-label="关闭">
              <IconX size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body">
          {mode === 'loading' && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--fresh-subtle)' }}>
              <p>加载中…</p>
            </div>
          )}

          {mode !== 'loading' && (
            <>
              {/* Title input (edit mode only) */}
              {mode === 'edit' && (
                <input
                  type="text"
                  className="input"
                  style={{ marginBottom: 12, fontSize: 16, fontWeight: 650 }}
                  placeholder="文章标题"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              )}

              {/* Toolbar (edit mode only) */}
              {mode === 'edit' && (
                <div className="tiptap-toolbar">
                  <div className="tiptap-toolbar-group">
                    <button
                      type="button"
                      className="tiptap-btn"
                      onClick={() => editor.chain().focus().toggleBold().run()}
                      title="加粗 (Ctrl+B)"
                    >
                      <strong>B</strong>
                    </button>
                    <button
                      type="button"
                      className="tiptap-btn"
                      onClick={() => editor.chain().focus().toggleItalic().run()}
                      title="斜体 (Ctrl+I)"
                    >
                      <em>I</em>
                    </button>
                  </div>
                  <div className="tiptap-toolbar-group">
                    <button
                      type="button"
                      className="tiptap-btn"
                      onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                      title="一级标题"
                    >
                      H1
                    </button>
                    <button
                      type="button"
                      className="tiptap-btn"
                      onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                      title="二级标题"
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      className="tiptap-btn"
                      onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                      title="三级标题"
                    >
                      H3
                    </button>
                  </div>
                  <div className="tiptap-toolbar-group">
                    <button
                      type="button"
                      className="tiptap-btn"
                      onClick={() => editor.chain().focus().toggleBulletList().run()}
                      title="无序列表"
                    >
                      •≡
                    </button>
                    <button
                      type="button"
                      className="tiptap-btn"
                      onClick={() => editor.chain().focus().toggleOrderedList().run()}
                      title="有序列表"
                    >
                      1.
                    </button>
                    <button
                      type="button"
                      className="tiptap-btn"
                      onClick={() => editor.chain().focus().toggleBlockquote().run()}
                      title="引用"
                    >
                      "
                    </button>
                  </div>
                  <div className="tiptap-toolbar-group">
                    <button
                      type="button"
                      className="tiptap-btn"
                      onClick={handleImageUpload}
                      title="插入图片"
                      disabled={uploading}
                    >
                      <IconImage size={15} />
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                </div>
              )}

              {/* Editor content */}
              <div className={`tiptap-editor-wrapper ${mode === 'view' ? 'view-mode' : ''}`}>
                <EditorContent editor={editor} />
              </div>

              {/* Error message */}
              {error && (
                <p style={{ color: 'var(--fresh-coral)', fontSize: 12, marginTop: 8 }}>{error}</p>
              )}
            </>
          )}
        </div>

        {/* Footer (edit mode only) */}
        {mode === 'edit' && (
          <div className="modal-footer">
            <span style={{ fontSize: 11, color: 'var(--fresh-subtle)', marginRight: 'auto' }}>
              {uploading ? '图片上传中…' : ''}
            </span>
            <button className="btn btn-outline" onClick={handleCancel}>
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || uploading}
            >
              <IconCheck size={14} />
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeModal;
