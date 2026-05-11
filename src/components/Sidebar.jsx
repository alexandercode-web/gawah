import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function Sidebar({ user, onLogout, hasUnreadNotifications, logoutRedirect }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = Number(user?.IsAdmin || 0) === 1 || user?.IsAdmin === true || String(user?.IsAdmin) === '1';

  const navItems = [
    { 
      label: 'Home', 
      path: '/home', 
      paths: ['M4 11.5 12 4l8 7.5V20H4z'] 
    },
    { 
      label: 'My Tasks', 
      path: '/tasks', 
      paths: [
        'M5 6h6v6H5z',
        'M14 7h5M14 12h5M5 17h14'
      ] 
    },
    ...(isAdmin ? [
      { 
        label: 'Admin Panels', 
        path: '/admin', 
        paths: [
          'M5 6h6v6H5z',
          'M14 7h5M14 12h5M5 17h14'
        ] 
      },
      { 
        label: 'Reports', 
        path: '/reports', 
        paths: [
          'M3 3v18h18',
          'M7 16l4-8 4 4 4-10'
        ] 
      },
      { 
        label: 'Settings', 
        path: '/admin/settings', 
        paths: [
          'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
          'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z'
        ] 
      }
    ] : []),
    { 
      label: 'Notifications', 
      path: '/notifications', 
      paths: [
        'M18 8a6 6 0 0 0-12 0v5l-2 3h16l-2-3z',
        'M10 19a2 2 0 0 0 4 0'
      ],
      hasBadge: hasUnreadNotifications
    },
    { 
      label: 'Profile', 
      path: '/profile', 
      paths: [
        'M12 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
        'M5 20a7 7 0 0 1 14 0'
      ] 
    }
  ];

  return (
    <nav className="nav-hint" aria-label="Bottom navigation">
      <div className="sidebar-header">
        <span className="sidebar-brand-icon" aria-hidden="true">
          <img src="/gawalogo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
        </span>
        <span className="sidebar-brand">GawaHelper</span>
      </div>

      {navItems.map((item) => {
        const isActive = location.pathname === item.path || (item.path !== '/home' && location.pathname.startsWith(item.path));
        
        return (
          <button 
            key={item.path}
            type="button" 
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className={`nav-icon ${item.hasBadge ? 'has-alert' : ''}`} aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                {item.paths.map((d, i) => (
                  <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </svg>
              {item.hasBadge && <span className="nav-alert-dot" />}
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}

      <button type="button" className="nav-item" onClick={() => onLogout(logoutRedirect)}>
        <span className="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="presentation" focusable="false">
            <path d="M10 7V5a2 2-2h6v18h-6a2 2 0 0 1-2-2v-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 12h11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="m6 9 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span>Log out</span>
      </button>
    </nav>
  );
}

export default Sidebar;
