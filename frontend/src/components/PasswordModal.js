import React, { useState } from 'react';
import { getApiUrl } from '../services/apiService';

const PasswordModal = ({ isOpen, onClose, onVerify, title, message }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('Please enter password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(getApiUrl('auth/verify-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: password.trim() })
      });

      const data = await response.json();

      if (data.success && data.valid) {
        setPassword('');
        setError('');
        onVerify(true);
      } else {
        setError('❌ Invalid password! Access denied.');
        setPassword('');
      }
    } catch (error) {
      console.error('Password verification error:', error);
      setError('Failed to verify password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPassword('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="password-modal-overlay">
      <div className="password-modal-container">
        <div className="password-modal-header">
          <h3>{title || '🔒 Password Required'}</h3>
        </div>

        <div className="password-modal-body">
          <p className="password-message">
            {message || 'Enter password to make changes to Production or COC data'}
          </p>

          <form onSubmit={handleSubmit}>
            <div className="password-input-group">
              <label>Password:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter password"
                className="password-input"
                autoFocus
                disabled={loading}
              />
            </div>

            {error && (
              <div className="password-error">
                {error}
              </div>
            )}

            <div className="password-modal-footer">
              <button 
                type="button"
                className="btn-cancel" 
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="btn-verify"
                disabled={loading}
              >
                {loading ? 'Verifying...' : '✓ Verify'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PasswordModal;
