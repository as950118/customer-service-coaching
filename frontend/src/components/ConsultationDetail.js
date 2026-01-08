import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getConsultation, downloadConsultationFile } from '../api';
import AnalysisResultDisplay from './AnalysisResultDisplay';
import Logo from './Logo';
import './ConsultationDetail.css';

function ConsultationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [consultation, setConsultation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadConsultation();
  }, [id]);

  const loadConsultation = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getConsultation(id);
      setConsultation(data);
    } catch (err) {
      console.error('상담 상세 조회 실패:', err);
      setError(err.message || '상담 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (consultation) {
      downloadConsultationFile(consultation.id, consultation.title);
    }
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="consultation-detail">
        <div className="detail-loading">
          <div className="loading-spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="consultation-detail">
        <div className="detail-error">
          <p>{error}</p>
          <button onClick={handleBack} className="btn btn-primary">
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="consultation-detail">
        <div className="detail-error">
          <p>상담 정보를 찾을 수 없습니다.</p>
          <button onClick={handleBack} className="btn btn-primary">
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="consultation-detail">
      <div className="detail-header">
        <Link to="/dashboard" className="detail-logo">
          <Logo size="small" showText={true} />
        </Link>
        <button onClick={handleBack} className="back-btn">
          ← 목록으로
        </button>
        <div className="header-actions">
          <button onClick={handleDownload} className="btn btn-secondary">
            원본 파일 다운로드
          </button>
        </div>
      </div>

      <div className="detail-content">
        <div className="detail-section">
          <h1 className="detail-title">{consultation.title}</h1>
          <div className="detail-meta">
            <div className="meta-item">
              <span className="meta-label">ID:</span>
              <span className="meta-value">{consultation.id}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">상태:</span>
              <span className={`status status-${consultation.status}`}>
                {consultation.status_display}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">파일 타입:</span>
              <span className="file-type-badge">{consultation.file_type}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">생성일:</span>
              <span className="meta-value">
                {new Date(consultation.created_at).toLocaleString('ko-KR')}
              </span>
            </div>
            {consultation.completed_at && (
              <div className="meta-item">
                <span className="meta-label">완료일:</span>
                <span className="meta-value">
                  {new Date(consultation.completed_at).toLocaleString('ko-KR')}
                </span>
              </div>
            )}
          </div>
        </div>

        {consultation.original_content && (
          <div className="detail-section">
            <h2 className="section-title">원본 내용</h2>
            <div className="content-box original-content-box">
              <pre className="content-text">{consultation.original_content}</pre>
            </div>
          </div>
        )}

        {consultation.analysis_result && (
          <AnalysisResultDisplay analysisResult={consultation.analysis_result} />
        )}

        {consultation.status === 'processing' && (
          <div className="detail-section">
            <div className="processing-notice">
              <p>분석이 진행 중입니다. 잠시 후 다시 확인해주세요.</p>
            </div>
          </div>
        )}

        {consultation.status === 'pending' && (
          <div className="detail-section">
            <div className="pending-notice">
              <p>분석 대기 중입니다.</p>
            </div>
          </div>
        )}

        {consultation.status === 'failed' && (
          <div className="detail-section">
            <div className="error-notice">
              <p>분석 중 오류가 발생했습니다.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConsultationDetail;

