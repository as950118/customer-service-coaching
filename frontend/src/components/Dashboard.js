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
            <button onClick={handleLogout} className="logout-btn">
              로그아웃
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

