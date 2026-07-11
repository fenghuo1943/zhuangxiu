import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../api/useAuth';
import { IconHome } from '../components/common/Icons';

const LoginPage: React.FC = () => {
  const { login, isLoggedIn, loading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isLoggedIn) navigate('/', { replace: true });
  }, [isLoggedIn, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    login(username.trim(), password);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link to="/" className="fresh-brand" style={{ justifyContent: 'center' }}>
            <span className="fresh-iconbox"><IconHome size={18} /></span>
            <span>小装家<small>清晰装修管家</small></span>
          </Link>
        </div>
        <h2>登录</h2>
        {error && (
          <div className="backup-msg error" style={{ marginBottom: 12 }}>
            {error}
            <button className="icon-btn" style={{ marginLeft: 8 }} onClick={clearError}>✕</button>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input className="input" style={{ width: '100%' }} value={username}
              onChange={e => setUsername(e.target.value)} placeholder="输入用户名" autoFocus />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input className="input" style={{ width: '100%' }} type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="输入密码" />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            type="submit" disabled={loading || !username.trim() || !password}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        <p className="auth-switch">
          还没有账号？<Link to="/register">立即注册</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
