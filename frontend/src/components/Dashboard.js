import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ConsultationUpload from './ConsultationUpload';
import ConsultationList from './ConsultationList';
import Logo from './Logo';
import { getConsultations, getCurrentUser } from '../api';
import './Dashboard.css';

function Dashboard() {
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [filters, setFilters] = useState({
    title: '',
    status: '',
    file_type: '',
    date_from: '',
    date_to: '',
  });
  const navigate = useNavigate();

  useEffect(() => {
    // 토큰 확인
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
      return;
    }

    loadUserInfo();
    loadConsultations();
  }, [navigate]);

  useEffect(() => {
    // 필터가 변경될 때마다 데이터 다시 로드
    loadConsultations();
  }, [filters]);

  const loadUserInfo = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const userData = await getCurrentUser(token);
      setUser(userData);
    } catch (error) {
      console.error('사용자 정보 로드 실패:', error);
    }
  };

  const loadConsultations = async () => {
    try {
      setLoading(true);
      const data = await getConsultations(filters);
      setConsultations(data.results || data);
    } catch (error) {
      console.error('상담 목록 로드 실패:', error);
      if (error.message.includes('401') || error.message.includes('인증')) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        navigate('/login');
        return;
      }
      setConsultations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    loadConsultations();
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/');
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <Link to="/dashboard" className="header-logo">
            <Logo size="small" showText={true} />
          </Link>
          <div className="header-right">
            {user && (
              <div className="user-info">
                <span className="user-name">{user.username}</span>
                {user.email && <span className="user-email">{user.email}</span>}
              </div>
            )}
            {(user?.is_staff || user?.is_superuser) && (
              <Link to="/admin" className="admin-link" title="관리자 대시보드">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18"></path>
                  <path d="M18 17V9"></path>
                  <path d="M13 17V5"></path>
                  <path d="M8 17v-3"></path>
                </svg>
                <span>관리자</span>
              </Link>
            )}
            <button onClick={handleLogout} className="logout-btn" title="로그아웃">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>로그아웃</span>
            </button>
          </div>
        </div>
      </header>
      <main className="dashboard-main">
        <ConsultationUpload onUploadSuccess={handleUploadSuccess} />
        <ConsultationList 
          consultations={consultations} 
          loading={loading}
          onRefresh={loadConsultations}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </main>
    </div>
  );
}

export default Dashboard;

