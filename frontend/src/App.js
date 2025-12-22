import React, { useState, useEffect } from 'react';
import IPQCForm from './components/IPQCForm';
import DailyReport from './components/DailyReport';
import PeelTestReport from './components/PeelTestReport';
import FTRDownload from './components/FTRDownload';
import FTRDeliveredUpload from './components/FTRDeliveredUpload';
import COCDashboard from './components/COCDashboard';
import PDIBatchManager from './components/PDIBatchManager';
import FTRReportManager from './components/FTRReportManager';
import TestReport from './components/TestReport';
import GraphManager from './components/GraphManager';
import UserManagement from './components/UserManagement';
import FTRManagement from './components/FTRManagement';
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

  useEffect(() => {
    // Check if user is already logged in
    const authStatus = localStorage.getItem('isAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
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
      case 'peel-test':
        return <PeelTestReport />;
      case 'ftr-download':
        return <FTRDownload />;
      case 'ftr-delivered':
        return <FTRDeliveredUpload />;
      case 'ftr-report':
        return <FTRReportManager />;
      case 'ftr-management':
        return <FTRManagement />;
      case 'test-report':
        return <TestReport moduleDatabase={moduleDatabase} />;
      case 'graph-manager':
        return <GraphManager />;
      case 'user-management':
        return <UserManagement />;
      case 'coc-dashboard':
        return <COCDashboard />;
      default:
        return <IPQCForm />;
    }
  };

  return (
    <div className="App">
      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <h2>{!sidebarCollapsed && 'PDI IPQC'}</h2>
          <button 
            className="toggle-btn" 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? '☰' : '✕'}
          </button>
        </div>

        {/* User Role Badge */}
        <div className={`user-role-badge ${sidebarCollapsed ? 'collapsed' : ''}`}>
          {localStorage.getItem('userRole') === 'super_admin' ? (
            <>
              <span className="role-icon">👑</span>
              {!sidebarCollapsed && <span className="role-text">Super Admin</span>}
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
          <li 
            className={activeSection === 'daily-report' ? 'active' : ''}
            onClick={() => setActiveSection('daily-report')}
            title="Daily Report"
          >
            <span className="icon">📊</span>
            {!sidebarCollapsed && <span className="label">Daily Report</span>}
          </li>
          <li 
            className={activeSection === 'pdi-batches' ? 'active' : ''}
            onClick={() => setActiveSection('pdi-batches')}
            title="PDI Batch Manager"
          >
            <span className="icon">🔢</span>
            {!sidebarCollapsed && <span className="label">PDI Batches</span>}
          </li>
          <li 
            className={activeSection === 'ipqc' ? 'active' : ''}
            onClick={() => setActiveSection('ipqc')}
            title="IPQC Form"
          >
            <span className="icon">📝</span>
            {!sidebarCollapsed && <span className="label">IPQC Form</span>}
          </li>
          <li 
            className={activeSection === 'peel-test' ? 'active' : ''}
            onClick={() => setActiveSection('peel-test')}
            title="Peel Test Report"
          >
            <span className="icon">🧪</span>
            {!sidebarCollapsed && <span className="label">Peel Test Report</span>}
          </li>
          <li 
            className={activeSection === 'ftr-download' ? 'active' : ''}
            onClick={() => setActiveSection('ftr-download')}
            title="FTR Download"
          >
            <span className="icon">📥</span>
            {!sidebarCollapsed && <span className="label">FTR Download</span>}
          </li>
          <li 
            className={activeSection === 'ftr-delivered' ? 'active' : ''}
            onClick={() => setActiveSection('ftr-delivered')}
            title="FTR Delivered"
          >
            <span className="icon">✅</span>
            {!sidebarCollapsed && <span className="label">FTR Delivered</span>}
          </li>
          <li 
            className={activeSection === 'ftr-report' ? 'active' : ''}
            onClick={() => setActiveSection('ftr-report')}
            title="FTR & Flash Report"
          >
            <span className="icon">⚡</span>
            {!sidebarCollapsed && <span className="label">FTR & Flash Report</span>}
          </li>
          <li 
            className={activeSection === 'ftr-management' ? 'active' : ''}
            onClick={() => setActiveSection('ftr-management')}
            title="FTR Management"
          >
            <span className="icon">🏭</span>
            {!sidebarCollapsed && <span className="label">FTR Management</span>}
          </li>
          <li 
            className={activeSection === 'test-report' ? 'active' : ''}
            onClick={() => setActiveSection('test-report')}
            title="Production Test Report"
          >
            <span className="icon">🔬</span>
            {!sidebarCollapsed && <span className="label">Production Test</span>}
          </li>
          <li 
            className={activeSection === 'graph-manager' ? 'active' : ''}
            onClick={() => setActiveSection('graph-manager')}
            title="I-V Graph Manager"
          >
            <span className="icon">📊</span>
            {!sidebarCollapsed && <span className="label">Graph Manager</span>}
          </li>
          {localStorage.getItem('userRole') === 'super_admin' && (
            <li 
              className={activeSection === 'user-management' ? 'active' : ''}
              onClick={() => setActiveSection('user-management')}
              title="User Management"
            >
              <span className="icon">👥</span>
              {!sidebarCollapsed && <span className="label">User Management</span>}
            </li>
          )}
          <li 
            className={activeSection === 'coc-dashboard' ? 'active' : ''}
            onClick={() => setActiveSection('coc-dashboard')}
            title="COC & Raw Material Dashboard"
          >
            <span className="icon">📋</span>
            {!sidebarCollapsed && <span className="label">COC Dashboard</span>}
          </li>
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
