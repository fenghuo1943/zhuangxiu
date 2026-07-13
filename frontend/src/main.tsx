import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ensureDeviceToken } from './api/auth';
import './styles/global.css';
import './styles/components.css';

// 启动时确保设备令牌存在（未登录时自动注册设备游客）
// 每个设备获得独立身份，数据互相隔离
ensureDeviceToken().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
