import React from 'react';
import { downloadConsultationFile } from '../api';
import './ConsultationList.css';

const ConsultationList = ({ consultations, loading, onRefresh }) => {
  if (loading) {
    return (
      <div className="consultation-list loading">
        <div className="loading-spinner"></div>
        <p>로딩 중...</p>
      </div>
    );
  }

  if (consultations.length === 0) {
    return (
      <div className="consultation-list">
        <h2>상담 목록</h2>
        <p>등록된 상담이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="consultation-list">
      <div className="list-header">
        <h2>상담 목록</h2>
        <button onClick={onRefresh}>새로고침</button>
      </div>
      <div className="consultations">
        {consultations.map((consultation) => (
          <div key={consultation.id} className="consultation-item">
            <div className="consultation-header">
              <h3>{consultation.title}</h3>
              <span className={`status status-${consultation.status}`}>
                {consultation.status_display}
              </span>
            </div>
            <div className="consultation-info">
              <p><strong>파일 타입:</strong> 
                <span className="file-type-badge">{consultation.file_type}</span>
              </p>
              <p><strong>생성일:</strong> {new Date(consultation.created_at).toLocaleString('ko-KR')}</p>
              {consultation.completed_at && (
                <p><strong>완료일:</strong> {new Date(consultation.completed_at).toLocaleString('ko-KR')}</p>
              )}
              <div className="file-actions">
                <button 
                  className="download-btn"
                  onClick={() => downloadConsultationFile(consultation.id, consultation.title)}
                >
                  원본 파일 다운로드
                </button>
              </div>
            </div>
            {consultation.original_content && (
              <div className="original-content">
                <h4>원본 내용</h4>
                <div className="result-content">{consultation.original_content}</div>
              </div>
            )}
            {consultation.analysis_result && (
              <div className="analysis-result">
                <h4>분석 결과</h4>
                <div className="result-content">{consultation.analysis_result}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConsultationList;

