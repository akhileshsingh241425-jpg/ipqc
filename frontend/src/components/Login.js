import React, { useState, useEffect } from 'react';
import '../styles/Login.css';

const Login = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Default users
  const DEFAULT_USERS = [
    { id: 1, username: 'admin@gautam', password: 'Admin@2025', name: 'Super Admin', role: 'super_admin' },
    { id: 2, username: 'user@gautam', password: 'User@2025', name: 'Production User', role: 'user' },
    { id: 3, username: 'Gautam@123', password: 'Gautam@321', name: 'Gautam Solar', role: 'super_admin' },
    { id: 4, username: 'ftr@gautam', password: 'Ftr@2025', name: 'FTR User', role: 'ftr_only' },
    { id: 5, username: 'ipqc@gautam', password: 'Ipqc@2025', name: 'IPQC User', role: 'ipqc_only' },
    { id: 6, username: 'coc@gautam', password: 'Coc@2025', name: 'COC User', role: 'coc_only' }
  ];

  // Initialize default users in localStorage on mount
  useEffect(() => {
    const storedUsers = localStorage.getItem('system_users');
    if (!storedUsers) {
      localStorage.setItem('system_users', JSON.stringify(DEFAULT_USERS));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    setTimeout(() => {
      // Load users from localStorage
      const storedUsers = localStorage.getItem('system_users');
      let users = {};

      if (storedUsers) {
        try {
          const usersArray = JSON.parse(storedUsers);
          // Convert array to object for easier lookup
          usersArray.forEach(user => {
            users[user.username] = {
              password: user.password,
              role: user.role,
              name: user.name
            };
          });
        } catch (error) {
          console.error('Failed to load users:', error);
          // Fallback to default users
          DEFAULT_USERS.forEach(user => {
            users[user.username] = {
              password: user.password,
              role: user.role,
              name: user.name
            };
          });
        }
      } else {
        // Fallback to default users
        DEFAULT_USERS.forEach(user => {
          users[user.username] = {
            password: user.password,
            role: user.role,
            name: user.name
          };
        });
      }

      const user = users[credentials.username];
      
      if (user && credentials.password === user.password) {
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userRole', user.role);
        localStorage.setItem('userName', user.name);
        localStorage.setItem('loginTime', new Date().toISOString());
        onLogin();
      } else {
        setError('❌ Invalid username or password');
        setLoading(false);
      }
    }, 500);
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>🏭 Gautam Solar</h1>
          <h2>PDI IPQC System</h2>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              name="username"
              value={credentials.username}
              onChange={handleChange}
              placeholder="Enter username"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              placeholder="Enter password"
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn-login"
            disabled={loading}
          >
            {loading ? '⏳ Logging in...' : '🔐 Login'}
          </button>
        </form>

        <div className="login-footer">
          <p>© 2025 Gautam Solar. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
