import React, { useState, useEffect } from 'react';
import IPQCForm from './components/IPQCForm';
import DailyReport from './components/DailyReport';
import FTRDownload from './components/FTRDownload';
import COCDashboard from './components/COCDashboard';
import PDIBatchManager from './components/PDIBatchManager';
import TestReport from './components/TestReport';
import GraphManager from './components/GraphManager';
import UserManagement from './components/UserManagement';
import AIAssistant from './components/AIAssistant';
import FTRDashboard from './components/FTRDashboard';
import COCManagementDashboard from './components/COCManagementDashboard';
import WitnessReport from './components/WitnessReport';
import CalibrationDashboard from './components/CalibrationDashboard';
import QMSDashboard from './components/QMSDashboard';
import Login from './components/Login';
import './styles/Navbar.css';
import './App.css';

// Complete Module Database with Market Standard and Golden Module specifications
const moduleDatabase = {
  // Mono PERC G2B Series (510W-560W)
  "G2B510": { 
    name: "G2B510-HAD", power: 510, cells: 144, size: "2278x1134x35", series: "Mono PERC G2B",
    market: {
      pmax: {exact: 510.0}, vmax: {exact: 39.5}, imax: {exact: 12.9}, 
      isc: {exact: 13.5}, voc: {exact: 47.8}
    },
    golden: {
      pmax: {exact: 510.0}, vmax: {exact: 39.5}, imax: {exact: 12.9}, 
      isc: {exact: 13.5}, voc: {exact: 47.8}
    }
  },
  "G2B520": { 
    name: "G2B520-HAD", power: 520, cells: 144, size: "2278x1134x35", series: "Mono PERC G2B",
    market: {
      pmax: {exact: 520.0}, vmax: {exact: 39.8}, imax: {exact: 13.1}, 
      isc: {exact: 13.7}, voc: {exact: 48.1}
    },
    golden: {
      pmax: {exact: 520.0}, vmax: {exact: 39.8}, imax: {exact: 13.1}, 
      isc: {exact: 13.7}, voc: {exact: 48.1}
    }
  },
  "G2B530": { 
    name: "G2B530-HAD", power: 530, cells: 144, size: "2278x1134x35", series: "Mono PERC G2B",
    market: {
      pmax: {exact: 530.0}, vmax: {exact: 40.1}, imax: {exact: 13.2}, 
      isc: {exact: 13.8}, voc: {exact: 48.3}
    },
    golden: {
      pmax: {exact: 530.0}, vmax: {exact: 40.1}, imax: {exact: 13.2}, 
      isc: {exact: 13.8}, voc: {exact: 48.3}
    }
  },
  "G2B540": { 
    name: "G2B540-HAD", power: 540, cells: 144, size: "2278x1134x35", series: "Mono PERC G2B",
    market: {
      pmax: {exact: 540.0}, vmax: {exact: 40.4}, imax: {exact: 13.4}, 
      isc: {exact: 14.0}, voc: {exact: 48.5}
    },
    golden: {
      pmax: {exact: 540.0}, vmax: {exact: 40.4}, imax: {exact: 13.4}, 
      isc: {exact: 14.0}, voc: {exact: 48.5}
    }
  },
  "G2X550": { 
    name: "G2X550-HAD", power: 550, cells: 144, size: "2278x1134x35", series: "Mono PERC G2X",
    market: {
      pmax: {exact: 550.100342}, vmax: {exact: 40.681176}, imax: {exact: 12.816929}, 
      isc: {exact: 13.632440}, voc: {exact: 48.797821}
    },
    golden: {
      pmax: {exact: 550.100342}, vmax: {exact: 40.681176}, imax: {exact: 12.816929}, 
      isc: {exact: 13.632440}, voc: {exact: 48.797821}
    }
  },
  "G2X560": { 
    name: "G2X560-HAD", power: 560, cells: 144, size: "2278x1134x35", series: "Mono PERC G2X",
    market: {
      pmax: {exact: 560.0}, vmax: {exact: 40.9}, imax: {exact: 13.7}, 
      isc: {exact: 14.3}, voc: {exact: 49.0}
    },
    golden: {
      pmax: {exact: 560.0}, vmax: {exact: 40.9}, imax: {exact: 13.7}, 
      isc: {exact: 14.3}, voc: {exact: 49.0}
    }
  },
  // TOPCon G2G Series (570W-610W)
  "G2G570": { 
    name: "G2G1570-HAD", power: 570, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    market: {
      pmax: {exact: 570.0}, vmax: {exact: 41.2}, imax: {exact: 13.8}, 
      isc: {exact: 14.4}, voc: {exact: 49.5}
    },
    golden: {
      pmax: {exact: 570.0}, vmax: {exact: 41.2}, imax: {exact: 13.8}, 
      isc: {exact: 14.4}, voc: {exact: 49.5}
    }
  },
  "G2G575": { 
    name: "G2G1725-HAD", power: 575, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    market: {
      pmax: {exact: 575.0}, vmax: {exact: 41.4}, imax: {exact: 13.9}, 
      isc: {exact: 14.5}, voc: {exact: 49.7}
    },
    golden: {
      pmax: {exact: 575.0}, vmax: {exact: 41.4}, imax: {exact: 13.9}, 
      isc: {exact: 14.5}, voc: {exact: 49.7}
    }
  },
  "G2G580": { 
    name: "G2G1740-HAD", power: 580, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    market: {
      pmax: {exact: 590.000000}, vmax: {exact: 42.140531}, imax: {exact: 14.093680}, 
      isc: {exact: 14.582912}, voc: {exact: 50.902770}
    },
    golden: {
      pmax: {exact: 600.356239}, vmax: {exact: 45.995040}, imax: {exact: 13.052630}, 
      isc: {exact: 13.644410}, voc: {exact: 53.474080}
    }
  },
  "G2G585": { 
    name: "G2G1755-HAD", power: 585, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    market: {
      pmax: {exact: 585.000000}, vmax: {exact: 41.645988}, imax: {exact: 13.999572}, 
      isc: {exact: 14.541549}, voc: {exact: 50.672640}
    },
    golden: {
      pmax: {exact: 585.0}, vmax: {exact: 41.8}, imax: {exact: 14.0}, 
      isc: {exact: 14.7}, voc: {exact: 50.1}
    }
  },
  "G2G590": { 
    name: "G2G1770-HAD", power: 590, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    market: {
      pmax: {exact: 596.421616}, vmax: {exact: 42.942838}, imax: {exact: 13.885481}, 
      isc: {exact: 14.635233}, voc: {exact: 51.677653}
    },
    golden: {
      pmax: {exact: 602.903316}, vmax: {exact: 45.796501}, imax: {exact: 13.283136}, 
      isc: {exact: 13.977882}, voc: {exact: 53.691753}
    }
  },
  "G2G595": { 
    name: "G2G1785-HAD", power: 595, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    market: {
      pmax: {exact: 595.000000}, vmax: {exact: 42.800000}, imax: {exact: 13.850000}, 
      isc: {exact: 14.650000}, voc: {exact: 51.450000}
    },
    golden: {
      pmax: {exact: 600.000000}, vmax: {exact: 42.850000}, imax: {exact: 13.950000}, 
      isc: {exact: 14.700000}, voc: {exact: 51.500000}
    }
  },
  "G2G600": { 
    name: "G2G1800-HAD", power: 600, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    market: {
      pmax: {exact: 600.0}, vmax: {exact: 42.6}, imax: {exact: 14.1}, 
      isc: {exact: 14.8}, voc: {exact: 51.0}
    },
    golden: {
      pmax: {exact: 600.0}, vmax: {exact: 42.6}, imax: {exact: 14.1}, 
      isc: {exact: 14.8}, voc: {exact: 51.0}
    }
  },
  "G2G605": { 
    name: "G2G1815-HAD", power: 605, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    market: {
      pmax: {exact: 605.0}, vmax: {exact: 42.8}, imax: {exact: 14.1}, 
      isc: {exact: 14.9}, voc: {exact: 51.2}
    },
    golden: {
      pmax: {exact: 605.0}, vmax: {exact: 42.8}, imax: {exact: 14.1}, 
      isc: {exact: 14.9}, voc: {exact: 51.2}
    }
  },
  "G2G610": { 
    name: "G2G1830-HAD", power: 610, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    market: {
      pmax: {exact: 610.0}, vmax: {exact: 43.0}, imax: {exact: 14.2}, 
      isc: {exact: 15.0}, voc: {exact: 51.4}
    },
    golden: {
      pmax: {exact: 610.0}, vmax: {exact: 43.0}, imax: {exact: 14.2}, 
      isc: {exact: 15.0}, voc: {exact: 51.4}
    }
  },
  // TOPCon G2G-G12R Series (615W-640W)
  "G3G615": { 
    name: "G3G1845K-UHAB", power: 615, cells: 132, size: "2382x1134x30", series: "TOPCon G2G-G12R",
    market: {
      pmax: {exact: 615.0}, vmax: {exact: 44.8}, imax: {exact: 13.7}, 
      isc: {exact: 14.4}, voc: {exact: 53.2}
    },
    golden: {
      pmax: {exact: 615.0}, vmax: {exact: 44.8}, imax: {exact: 13.7}, 
      isc: {exact: 14.4}, voc: {exact: 53.2}
    }
  },
  "G3G620": { 
    name: "G3G1860K-UHAB", power: 620, cells: 132, size: "2382x1134x30", series: "TOPCon G2G-G12R",
    market: {
      pmax: {exact: 620.0}, vmax: {exact: 45.0}, imax: {exact: 13.8}, 
      isc: {exact: 14.5}, voc: {exact: 53.4}
    },
    golden: {
      pmax: {exact: 620.0}, vmax: {exact: 45.0}, imax: {exact: 13.8}, 
      isc: {exact: 14.5}, voc: {exact: 53.4}
    }
  },
  "G3G625": { 
    name: "G3G1875K-UHAB", power: 625, cells: 132, size: "2382x1134x30", series: "TOPCon G2G-G12R",
    market: {
      pmax: {exact: 625.0}, vmax: {exact: 45.2}, imax: {exact: 13.8}, 
      isc: {exact: 14.6}, voc: {exact: 53.6}
    },
    golden: {
      pmax: {exact: 625.0}, vmax: {exact: 45.2}, imax: {exact: 13.8}, 
      isc: {exact: 14.6}, voc: {exact: 53.6}
    }
  },
  "G3G630": { 
    name: "G3G1890K-UHAB", power: 630, cells: 132, size: "2382x1134x30", series: "TOPCon G2G-G12R",
    market: {
      pmax: {exact: 630.0}, vmax: {exact: 45.4}, imax: {exact: 13.9}, 
      isc: {exact: 14.7}, voc: {exact: 53.8}
    },
    golden: {
      pmax: {exact: 630.0}, vmax: {exact: 45.4}, imax: {exact: 13.9}, 
      isc: {exact: 14.7}, voc: {exact: 53.8}
    }
  },
  "G3G635": { 
    name: "G3G1905K-UHAB", power: 635, cells: 132, size: "2382x1134x30", series: "TOPCon G2G-G12R",
    market: {
      pmax: {exact: 635.0}, vmax: {exact: 45.6}, imax: {exact: 13.9}, 
      isc: {exact: 14.8}, voc: {exact: 54.0}
    },
    golden: {
      pmax: {exact: 635.0}, vmax: {exact: 45.6}, imax: {exact: 13.9}, 
      isc: {exact: 14.8}, voc: {exact: 54.0}
    }
  },
  "G3G640": { 
    name: "G3G1920K-UHAB", power: 640, cells: 132, size: "2382x1134x30", series: "TOPCon G2G-G12R",
    market: {
      pmax: {exact: 640.0}, vmax: {exact: 45.8}, imax: {exact: 14.0}, 
      isc: {exact: 14.9}, voc: {exact: 54.2}
    },
    golden: {
      pmax: {exact: 640.0}, vmax: {exact: 45.8}, imax: {exact: 14.0}, 
      isc: {exact: 14.9}, voc: {exact: 54.2}
    }
  },
  // G12R High Power Series (622W-652W)
  "G12R622": { 
    name: "G12R-622W", power: 622, cells: 132, size: "2382x1134x30", series: "G12R High Power",
    market: {
      pmax: {exact: 622.32588}, vmax: {exact: 40.59}, imax: {exact: 15.332000}, 
      isc: {exact: 15.810000}, voc: {exact: 48.246}
    },
    golden: {
      pmax: {exact: 622.32588}, vmax: {exact: 40.59}, imax: {exact: 15.332000}, 
      isc: {exact: 15.810000}, voc: {exact: 48.246}
    }
  },
  "G12R652": { 
    name: "G12R-652W", power: 652, cells: 132, size: "2382x1134x30", series: "G12R High Power",
    market: {
      pmax: {exact: 652.05617}, vmax: {exact: 41.382}, imax: {exact: 15.757000}, 
      isc: {exact: 15.940000}, voc: {exact: 49.104}
    },
    golden: {
      pmax: {exact: 652.05617}, vmax: {exact: 41.382}, imax: {exact: 15.757000}, 
      isc: {exact: 15.940000}, voc: {exact: 49.104}
    }
  }
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeSection, setActiveSection] = useState('ipqc');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Get user role
  const userRole = localStorage.getItem('userRole') || 'user';

  // Role-based access configuration
  const roleAccess = {
    super_admin: ['all'], // Full access
    user: ['all'], // Full access for normal users too
    ftr_only: ['ftr-download', 'test-report', 'graph-manager', 'ai-assistant', 'ftr-dashboard', 'witness-report'],
    ipqc_only: ['ipqc', 'daily-report', 'pdi-batches'],
    coc_only: ['coc-dashboard', 'coc-management']
  };

  // Check if user has access to a section
  const hasAccess = (section) => {
    const access = roleAccess[userRole] || ['all'];
    return access.includes('all') || access.includes(section);
  };

  // Get default section based on role
  const getDefaultSection = () => {
    if (userRole === 'ftr_only') return 'ftr-download';
    if (userRole === 'ipqc_only') return 'ipqc';
    if (userRole === 'coc_only') return 'coc-dashboard';
    return 'ipqc';
  };

  useEffect(() => {
    // Check if user is already logged in
    const authStatus = localStorage.getItem('isAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      // Set default section based on role
      setActiveSection(getDefaultSection());
    }
    
    // Handle window resize for mobile detection
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileMenuOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('loginTime');
    setIsAuthenticated(false);
    setActiveSection('ipqc');
  };

  const handleMenuItemClick = (section) => {
    setActiveSection(section);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const renderSection = () => {
    switch(activeSection) {
      case 'ipqc':
        return <IPQCForm />;
      case 'daily-report':
        return <DailyReport />;
      case 'pdi-batches':
        return <PDIBatchManager />;

      case 'ftr-download':
        return <FTRDownload />;

      case 'witness-report':
        return <WitnessReport />;
      case 'ai-assistant':
        return <AIAssistant />;
      case 'ftr-dashboard':
        return <FTRDashboard />;
      case 'test-report':
        return <TestReport moduleDatabase={moduleDatabase} />;
      case 'graph-manager':
        return <GraphManager />;
      case 'user-management':
        return <UserManagement />;
      case 'coc-dashboard':
        return <COCDashboard />;
      case 'coc-management':
        return <COCManagementDashboard />;
      case 'calibration':
        return <CalibrationDashboard />;
      case 'qms':
        return <QMSDashboard />;
      default:
        return <IPQCForm />;
    }
  };

  return (
    <div className="App">
      {/* Mobile Menu Toggle Button */}
      {isMobile && (
        <button 
          className="toggle-btn mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            position: 'fixed',
            left: '10px',
            top: '10px',
            zIndex: 1001,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '12px 14px',
            borderRadius: '8px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
            border: 'none',
            color: 'white',
            fontSize: '18px',
            cursor: 'pointer'
          }}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      )}
      
      {/* Mobile Overlay */}
      {isMobile && mobileMenuOpen && (
        <div 
          className="sidebar-overlay active"
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999
          }}
        />
      )}
      
      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${isMobile && mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <h2>{!sidebarCollapsed && 'PDI IPQC'}</h2>
          {!isMobile && (
            <button 
              className="toggle-btn" 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? '☰' : '✕'}
            </button>
          )}
        </div>

        {/* User Role Badge */}
        <div className={`user-role-badge ${sidebarCollapsed ? 'collapsed' : ''}`}>
          {userRole === 'super_admin' ? (
            <>
              <span className="role-icon">👑</span>
              {!sidebarCollapsed && <span className="role-text">Super Admin</span>}
            </>
          ) : userRole === 'ftr_only' ? (
            <>
              <span className="role-icon">⚡</span>
              {!sidebarCollapsed && <span className="role-text">FTR Access</span>}
            </>
          ) : userRole === 'ipqc_only' ? (
            <>
              <span className="role-icon">📝</span>
              {!sidebarCollapsed && <span className="role-text">IPQC Access</span>}
            </>
          ) : userRole === 'coc_only' ? (
            <>
              <span className="role-icon">📦</span>
              {!sidebarCollapsed && <span className="role-text">COC Access</span>}
            </>
          ) : (
            <>
              <span className="role-icon">👤</span>
              {!sidebarCollapsed && <span className="role-text">User</span>}
            </>
          )}
          {!sidebarCollapsed && <div className="user-name">{localStorage.getItem('userName') || 'User'}</div>}
        </div>

        <ul className="sidebar-menu">
          {hasAccess('daily-report') && (
            <li 
              className={activeSection === 'daily-report' ? 'active' : ''}
              onClick={() => handleMenuItemClick('daily-report')}
              title="Daily Report"
            >
              <span className="icon">📊</span>
              {!sidebarCollapsed && <span className="label">Daily Report</span>}
            </li>
          )}
          {hasAccess('pdi-batches') && (
            <li 
              className={activeSection === 'pdi-batches' ? 'active' : ''}
              onClick={() => handleMenuItemClick('pdi-batches')}
              title="PDI Batch Manager"
            >
              <span className="icon">🔢</span>
              {!sidebarCollapsed && <span className="label">PDI Batches</span>}
            </li>
          )}
          {hasAccess('ipqc') && (
            <li 
              className={activeSection === 'ipqc' ? 'active' : ''}
              onClick={() => handleMenuItemClick('ipqc')}
              title="IPQC Form"
            >
              <span className="icon">📝</span>
              {!sidebarCollapsed && <span className="label">IPQC Form</span>}
            </li>
          )}

          {hasAccess('ftr-download') && (
            <li 
              className={activeSection === 'ftr-download' ? 'active' : ''}
              onClick={() => handleMenuItemClick('ftr-download')}
              title="FTR Download"
            >
              <span className="icon">📥</span>
              {!sidebarCollapsed && <span className="label">FTR Download</span>}
            </li>
          )}

          {hasAccess('witness-report') && (
            <li 
              className={activeSection === 'witness-report' ? 'active' : ''}
              onClick={() => handleMenuItemClick('witness-report')}
              title="Witness Report"
            >
              <span className="icon">📋</span>
              {!sidebarCollapsed && <span className="label">Witness Report</span>}
            </li>
          )}
          {hasAccess('ai-assistant') && (
            <li 
              className={activeSection === 'ai-assistant' ? 'active' : ''}
              onClick={() => handleMenuItemClick('ai-assistant')}
              title="AI FTR Assistant"
            >
              <span className="icon">🤖</span>
              {!sidebarCollapsed && <span className="label">AI Assistant</span>}
            </li>
          )}
          {hasAccess('ftr-dashboard') && (
            <li 
              className={activeSection === 'ftr-dashboard' ? 'active' : ''}
              onClick={() => handleMenuItemClick('ftr-dashboard')}
              title="FTR Analytics Dashboard"
            >
              <span className="icon">📊</span>
              {!sidebarCollapsed && <span className="label">FTR Dashboard</span>}
            </li>
          )}
          {hasAccess('test-report') && (
            <li 
              className={activeSection === 'test-report' ? 'active' : ''}
              onClick={() => handleMenuItemClick('test-report')}
              title="Production Test Report"
            >
              <span className="icon">🔬</span>
              {!sidebarCollapsed && <span className="label">Production Test</span>}
            </li>
          )}
          {hasAccess('graph-manager') && (
            <li 
              className={activeSection === 'graph-manager' ? 'active' : ''}
              onClick={() => handleMenuItemClick('graph-manager')}
              title="I-V Graph Manager"
            >
              <span className="icon">📊</span>
              {!sidebarCollapsed && <span className="label">Graph Manager</span>}
            </li>
          )}
          {userRole === 'super_admin' && (
            <li 
              className={activeSection === 'user-management' ? 'active' : ''}
              onClick={() => handleMenuItemClick('user-management')}
              title="User Management"
            >
              <span className="icon">👥</span>
              {!sidebarCollapsed && <span className="label">User Management</span>}
            </li>
          )}
          {hasAccess('coc-dashboard') && (
            <li 
              className={activeSection === 'coc-dashboard' ? 'active' : ''}
              onClick={() => handleMenuItemClick('coc-dashboard')}
              title="COC & Raw Material Dashboard"
            >
              <span className="icon">📋</span>
              {!sidebarCollapsed && <span className="label">COC Dashboard</span>}
            </li>
          )}
          {hasAccess('coc-management') && (
            <li 
              className={activeSection === 'coc-management' ? 'active' : ''}
              onClick={() => handleMenuItemClick('coc-management')}
              title="COC Usage Tracking & FIFO Management"
            >
              <span className="icon">📦</span>
              {!sidebarCollapsed && <span className="label">COC Management</span>}
            </li>
          )}
          {hasAccess('calibration') && (
            <li 
              className={activeSection === 'calibration' ? 'active' : ''}
              onClick={() => handleMenuItemClick('calibration')}
              title="Calibration Management"
            >
              <span className="icon">🔧</span>
              {!sidebarCollapsed && <span className="label">Calibration</span>}
            </li>
          )}
          {hasAccess('qms') && (
            <li 
              className={activeSection === 'qms' ? 'active' : ''}
              onClick={() => handleMenuItemClick('qms')}
              title="Quality Management System"
            >
              <span className="icon">🛡️</span>
              {!sidebarCollapsed && <span className="label">QMS</span>}
            </li>
          )}
          <li 
            className="logout-btn"
            onClick={handleLogout}
            title="Logout"
          >
            <span className="icon">🚪</span>
            {!sidebarCollapsed && <span className="label">Logout</span>}
          </li>
        </ul>
      </div>
      <div className={`main-content ${sidebarCollapsed ? 'expanded' : ''}`}>
        {renderSection()}
      </div>
    </div>
  );
}

export default App;
