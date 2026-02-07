import React, { useState, useEffect } from 'react';
import '../styles/UserManagement.css';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    name: '',
    role: 'user'
  });
  const [editingUser, setEditingUser] = useState(null);

  // Check if current user is super admin
  const isSuperAdmin = () => {
    return localStorage.getItem('userRole') === 'super_admin';
  };

  // Load users from localStorage on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    const storedUsers = localStorage.getItem('system_users');
    if (storedUsers) {
      try {
        setUsers(JSON.parse(storedUsers));
      } catch (error) {
        console.error('Failed to load users:', error);
      }
    } else {
      // Initialize with default users
      const defaultUsers = [
        { id: 1, username: 'admin@gautam', password: 'Admin@2025', name: 'Super Admin', role: 'super_admin' },
        { id: 2, username: 'user@gautam', password: 'User@2025', name: 'Production User', role: 'user' },
        { id: 3, username: 'Gautam@123', password: 'Gautam@321', name: 'Gautam Solar', role: 'super_admin' },
        { id: 4, username: 'ftr@gautam', password: 'Ftr@2025', name: 'FTR User', role: 'ftr_only' },
        { id: 5, username: 'ipqc@gautam', password: 'Ipqc@2025', name: 'IPQC User', role: 'ipqc_only' },
        { id: 6, username: 'coc@gautam', password: 'Coc@2025', name: 'COC User', role: 'coc_only' }
      ];
      localStorage.setItem('system_users', JSON.stringify(defaultUsers));
      setUsers(defaultUsers);
    }
  };

  const handleAddUser = () => {
    if (!newUser.username || !newUser.password || !newUser.name) {
      alert('Please fill all fields!');
      return;
    }

    // Check if username already exists
    if (users.some(u => u.username === newUser.username)) {
      alert('Username already exists!');
      return;
    }

    const userToAdd = {
      id: Date.now(),
      username: newUser.username,
      password: newUser.password,
      name: newUser.name,
      role: newUser.role
    };

    const updatedUsers = [...users, userToAdd];
    localStorage.setItem('system_users', JSON.stringify(updatedUsers));
    setUsers(updatedUsers);
    
    // Reset form
    setNewUser({ username: '', password: '', name: '', role: 'user' });
    setShowAddModal(false);
    alert('✅ User added successfully!');
  };

  const handleUpdateUser = () => {
    if (!editingUser.username || !editingUser.password || !editingUser.name) {
      alert('Please fill all fields!');
      return;
    }

    const updatedUsers = users.map(u => 
      u.id === editingUser.id ? editingUser : u
    );
    localStorage.setItem('system_users', JSON.stringify(updatedUsers));
    setUsers(updatedUsers);
    setEditingUser(null);
    alert('✅ User updated successfully!');
  };

  const handleDeleteUser = (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      const updatedUsers = users.filter(u => u.id !== userId);
      localStorage.setItem('system_users', JSON.stringify(updatedUsers));
      setUsers(updatedUsers);
      alert('✅ User deleted successfully!');
    }
  };

  if (!isSuperAdmin()) {
    return (
      <div className="user-management">
        <div className="access-denied">
          <h2>🔒 Access Denied</h2>
          <p>Only Super Admins can manage users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="user-management-header">
        <div>
          <h2>👥 User Management</h2>
          <p className="subtitle">Create and manage user accounts for the PDI IPQC system</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-add-user">
          ➕ Add New User
        </button>
      </div>

      {/* Users Table */}
      <div className="users-table-section">
        <h3>📋 All Users ({users.length})</h3>
        <div className="table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Username</th>
                <th>Name</th>
                <th>Role</th>
                <th>Password</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={user.id}>
                  <td>{index + 1}</td>
                  <td>
                    <span className="username-badge">{user.username}</span>
                  </td>
                  <td>{user.name}</td>
                  <td>
                    {user.role === 'super_admin' ? (
                      <span className="role-badge admin">👑 Super Admin</span>
                    ) : user.role === 'ftr_only' ? (
                      <span className="role-badge ftr">⚡ FTR Only</span>
                    ) : user.role === 'ipqc_only' ? (
                      <span className="role-badge ipqc">📝 IPQC Only</span>
                    ) : user.role === 'coc_only' ? (
                      <span className="role-badge coc">📦 COC Only</span>
                    ) : (
                      <span className="role-badge user">👤 User</span>
                    )}
                  </td>
                  <td>
                    <code className="password-display">{'•'.repeat(user.password.length)}</code>
                    <button 
                      className="btn-show-password"
                      onClick={() => alert(`Password: ${user.password}`)}
                      title="Show password"
                    >
                      👁️
                    </button>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn-edit"
                        onClick={() => setEditingUser({...user})}
                        title="Edit user"
                      >
                        ✏️
                      </button>
                      <button 
                        className="btn-delete"
                        onClick={() => handleDeleteUser(user.id)}
                        title="Delete user"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>➕ Add New User</h3>
            <div className="form-group">
              <label>Username (Email format)</label>
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                placeholder="e.g., user@gautam"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="text"
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                placeholder="Enter password"
              />
            </div>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={newUser.name}
                onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                placeholder="Enter full name"
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({...newUser, role: e.target.value})}
              >
                <option value="user">👤 Normal User (View/Update Only)</option>
                <option value="super_admin">👑 Super Admin (Full Access)</option>
                <option value="ftr_only">⚡ FTR Only (Flash Test Reports)</option>
                <option value="ipqc_only">📝 IPQC Only (IPQC & Daily Report)</option>
                <option value="coc_only">📦 COC Only (COC Management)</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-save" onClick={handleAddUser}>Add User</button>
              <button className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>✏️ Edit User</h3>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={editingUser.username}
                onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                disabled
                style={{backgroundColor: '#f0f0f0', cursor: 'not-allowed'}}
              />
              <small style={{color: '#666'}}>Username cannot be changed</small>
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="text"
                value={editingUser.password}
                onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                placeholder="Enter new password"
              />
            </div>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={editingUser.name}
                onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                placeholder="Enter full name"
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select
                value={editingUser.role}
                onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
              >
                <option value="user">👤 Normal User (View/Update Only)</option>
                <option value="super_admin">👑 Super Admin (Full Access)</option>
                <option value="ftr_only">⚡ FTR Only (Flash Test Reports)</option>
                <option value="ipqc_only">📝 IPQC Only (IPQC & Daily Report)</option>
                <option value="coc_only">📦 COC Only (COC Management)</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-save" onClick={handleUpdateUser}>Update User</button>
              <button className="btn-cancel" onClick={() => setEditingUser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
