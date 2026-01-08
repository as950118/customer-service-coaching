import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { downloadConsultationFile } from '../api';
import './ConsultationList.css';

const ConsultationList = ({ consultations, loading, onRefresh, filters, onFiltersChange }) => {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  
  // 필터 상태 관리
  const [localFilters, setLocalFilters] = useState({
    title: filters?.title || '',
    status: filters?.status || '',
    file_type: filters?.file_type || '',
    date_from: filters?.date_from || '',
    date_to: filters?.date_to || '',
  });

  // 필터 적용
  const handleFilterChange = (key, value) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    }
  };

  // 필터 초기화
  const handleResetFilters = () => {
    const emptyFilters = {
      title: '',
      status: '',
      file_type: '',
      date_from: '',
      date_to: '',
    };
    setLocalFilters(emptyFilters);
    if (onFiltersChange) {
      onFiltersChange(emptyFilters);
    }
  };

  // 활성 필터 개수 계산
  const activeFilterCount = useMemo(() => {
    return Object.values(localFilters).filter(v => v !== '').length;
  }, [localFilters]);

  if (loading) {
    return (
      <div className="consultation-list loading">
        <div className="loading-spinner"></div>
        <p>로딩 중...</p>
      </div>
    );
  }

  const handleRowClick = (id) => {
    navigate(`/consultations/${id}`);
  };

  const handleDownloadClick = async (e, id, title) => {
    e.stopPropagation(); // 테이블 행 클릭 이벤트 전파 방지
    try {
      await downloadConsultationFile(id, title);
    } catch (error) {
      console.error('다운로드 실패:', error);
      alert(error.message || '파일 다운로드에 실패했습니다.');
    }
  };

  return (
    <div className="consultation-list">
      <div className="list-header">
        <h2>상담 목록</h2>
        <div className="list-actions">
          <div className="search-box">
            <input
              type="text"
              placeholder="제목 검색"
              value={localFilters.title}
              onChange={(e) => handleFilterChange('title', e.target.value)}
              className="search-input"
            />
            {localFilters.title && (
              <button 
                className="search-clear"
                onClick={() => handleFilterChange('title', '')}
                title="검색 초기화"
              >
                ×
              </button>
            )}
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)} 
            className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
            title="필터"
          >
            🔍 필터 {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
          <button onClick={onRefresh} className="refresh-btn" title="새로고침">
            🔄
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="filter-panel">
          <div className="filter-row">
            <div className="filter-group">
              <label>상태</label>
              <select
                value={localFilters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="filter-select"
              >
                <option value="">전체</option>
                <option value="pending">대기중</option>
                <option value="processing">처리중</option>
                <option value="completed">완료</option>
                <option value="failed">실패</option>
              </select>
            </div>
            <div className="filter-group">
              <label>파일 타입</label>
              <select
                value={localFilters.file_type}
                onChange={(e) => handleFilterChange('file_type', e.target.value)}
                className="filter-select"
              >
                <option value="">전체</option>
                <option value="text">텍스트</option>
                <option value="audio">오디오</option>
                <option value="video">비디오</option>
              </select>
            </div>
            <div className="filter-group">
              <label>시작일</label>
              <input
                type="date"
                value={localFilters.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                className="filter-date"
              />
            </div>
            <div className="filter-group">
              <label>종료일</label>
              <input
                type="date"
                value={localFilters.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                className="filter-date"
              />
            </div>
            <div className="filter-actions">
              <button onClick={handleResetFilters} className="filter-reset-btn">
                초기화
              </button>
            </div>
          </div>
        </div>
      )}

      {consultations.length === 0 ? (
        <div className="empty-state">
          <p className="empty-message">
            {activeFilterCount > 0 ? '필터 조건에 맞는 상담이 없습니다.' : '등록된 상담이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table className="consultation-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>제목</th>
                <th>파일 타입</th>
                <th>상태</th>
                <th>생성일</th>
                <th>완료일</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {consultations.map((consultation) => (
                <tr 
                  key={consultation.id} 
                  className="table-row"
                  onClick={() => handleRowClick(consultation.id)}
                >
                  <td className="id-cell">{consultation.id}</td>
                  <td className="title-cell">{consultation.title}</td>
                  <td>
                    <span className="file-type-badge">{consultation.file_type}</span>
                  </td>
                  <td>
                    <span className={`status status-${consultation.status}`}>
                      {consultation.status_display}
                    </span>
                  </td>
                  <td className="date-cell">
                    {new Date(consultation.created_at).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    })}
                    <br />
                    <span className="time-text">
                      {new Date(consultation.created_at).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </td>
                  <td className="date-cell">
                    {consultation.completed_at 
                      ? (
                        <>
                          {new Date(consultation.completed_at).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          })}
                          <br />
                          <span className="time-text">
                            {new Date(consultation.completed_at).toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </>
                      )
                      : '-'
                    }
                  </td>
                  <td>
                    <button 
                      className="download-btn"
                      onClick={(e) => handleDownloadClick(e, consultation.id, consultation.title)}
                      title="원본 파일 다운로드"
                    >
                      ⬇
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ConsultationList;

