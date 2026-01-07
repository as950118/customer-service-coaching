import React, { useState, useEffect } from 'react';
import './App.css';
import ConsultationUpload from './components/ConsultationUpload';
import ConsultationList from './components/ConsultationList';
import { getConsultations } from './api';

function App() {
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConsultations();
  }, []);

  const loadConsultations = async () => {
    try {
      setLoading(true);
      const data = await getConsultations();
      setConsultations(data.results || data);
    } catch (error) {
      console.error('상담 목록 로드 실패:', error);
      // 에러 발생 시 빈 배열로 설정
      setConsultations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    loadConsultations();
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>고객 상담 코칭 시스템</h1>
      </header>
      <main className="App-main">
        <ConsultationUpload onUploadSuccess={handleUploadSuccess} />
        <ConsultationList 
          consultations={consultations} 
          loading={loading}
          onRefresh={loadConsultations}
        />
      </main>
    </div>
  );
}

export default App;
