import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../api/useAuth';
import { IconHome } from '../components/common/Icons';

const RegisterPage: React.FC = () => {
  const { register, isLoggedIn, loading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (isLoggedIn) navigate('/', { replace: true });
  }, [isLoggedIn, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!username.trim() || !email.trim() || !password) return;
    if (password !== password2) {
      setLocalError('两次密码不一致');
      return;
    }
    if (password.length < 6) {
      setLocalError('密码至少 6 位');
      return;
    }
    register(username.trim(), email.trim(), password);
  };

  const displayError = localError || error;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link to="/" className="fresh-brand" style={{ justifyContent: 'center' }}>
            <span className="fresh-iconbox"><IconHome size={18} /></span>
            <span>小装家<small>清晰装修管家</small></span>
          </Link>
        </div>
        <h2>注册</h2>
        {displayError && (
          <div className="backup-msg error" style={{ marginBottom: 12 }}>
            {displayError}
            <button className="icon-btn" style={{ marginLeft: 8 }} onClick={() => { clearError(); setLocalError(''); }}>✕</button>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input className="input" style={{ width: '100%' }} value={username}
              onChange={e => setUsername(e.target.value)} placeholder="2-50 个字符" autoFocus />
          </div>
          <div className="form-group">
            <label>邮箱</label>
            <input className="input" style={{ width: '100%' }} type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input className="input" style={{ width: '100%' }} type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="至少 6 位" />
          </div>
          <div className="form-group">
            <label>确认密码</label>
            <input className="input" style={{ width: '100%' }} type="password" value={password2}
              onChange={e => setPassword2(e.target.value)} placeholder="再次输入密码" />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            type="submit" disabled={loading || !username.trim() || !email.trim() || !password}>
            {loading ? '注册中...' : '注册'}
          </button>
        </form>
        <p className="auth-switch">
          已有账号？<Link to="/login">去登录</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
