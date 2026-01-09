import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../api';
import Logo from './Logo';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './AdminDashboard.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

function AdminDashboard() {
  const [kpiData, setKpiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
      return;
    }

    loadUserInfo();
    loadKPIData();
  }, [navigate, period, dateFrom, dateTo]);

  const loadUserInfo = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const userData = await getCurrentUser(token);
      setUser(userData);
    } catch (error) {
      console.error('사용자 정보 로드 실패:', error);
    }
  };

  const loadKPIData = async () => {
    try {
      setLoading(true);
      setError(null);
      const queryString = new URLSearchParams();
      if (period) queryString.append('period', period);
      if (dateFrom) queryString.append('date_from', dateFrom);
      if (dateTo) queryString.append('date_to', dateTo);
      
      const queryStr = queryString.toString();
      const url = `${API_BASE_URL}/admin/kpi/${queryStr ? '?' + queryStr : ''}`;
      const token = localStorage.getItem('access_token');
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('관리자 권한이 필요합니다.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'KPI 조회 실패');
      }

      const data = await response.json();
      setKpiData(data);
    } catch (err) {
      console.error('KPI 데이터 로드 실패:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/');
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '-';
    return typeof num === 'number' ? num.toLocaleString() : num;
  };

  const formatSeconds = (seconds) => {
    if (seconds === null || seconds === undefined) return '-';
    if (seconds < 60) return `${Math.round(seconds)}초`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}분`;
    return `${Math.round(seconds / 3600)}시간`;
  };

  const getStatusColor = (value, target, isLowerBetter = false) => {
    if (value === null || value === undefined || target === null || target === undefined) return '';
    if (isLowerBetter) {
      return value <= target ? 'status-good' : 'status-warning';
    }
    return value >= target ? 'status-good' : 'status-warning';
  };

  const exportToExcel = () => {
    if (!kpiData) return;

    const wb = XLSX.utils.book_new();
    const wsData = [];

    // 제목
    wsData.push(['고객 상담 코칭 시스템 KPI 리포트']);
    wsData.push(['생성일시', new Date().toLocaleString('ko-KR')]);
    wsData.push(['기간', period === 'all' ? '전체' : period === 'daily' ? '일간' : period === 'weekly' ? '주간' : '월간']);
    if (kpiData.date_range.from) {
      wsData.push(['시작일', kpiData.date_range.from]);
    }
    if (kpiData.date_range.to) {
      wsData.push(['종료일', kpiData.date_range.to]);
    }
    wsData.push([]);

    // 사용자 활동 지표
    wsData.push(['1. 사용자 활동 지표']);
    wsData.push(['지표', '값', '목표']);
    wsData.push(['전체 상담 수', kpiData.user_engagement.total_consultations, '-']);
    if (kpiData.user_engagement.daily_consultations !== null) {
      wsData.push(['일일 업로드 수', kpiData.user_engagement.daily_consultations, kpiData.targets.daily_consultations]);
    }
    if (kpiData.user_engagement.weekly_consultations !== null) {
      wsData.push(['주간 업로드 수', kpiData.user_engagement.weekly_consultations, kpiData.targets.weekly_consultations]);
    }
    if (kpiData.user_engagement.monthly_consultations !== null) {
      wsData.push(['월간 업로드 수', kpiData.user_engagement.monthly_consultations, kpiData.targets.monthly_consultations]);
    }
    if (kpiData.user_engagement.dau !== null) {
      wsData.push(['일일 활성 사용자 (DAU)', kpiData.user_engagement.dau, '-']);
    }
    if (kpiData.user_engagement.wau !== null) {
      wsData.push(['주간 활성 사용자 (WAU)', kpiData.user_engagement.wau, '-']);
    }
    if (kpiData.user_engagement.return_rate !== null) {
      wsData.push(['재방문율 (%)', kpiData.user_engagement.return_rate, '40']);
    }
    wsData.push(['파일 타입별 분포']);
    Object.entries(kpiData.user_engagement.file_type_distribution).forEach(([type, percentage]) => {
      wsData.push([`  ${type}`, `${percentage}% (${kpiData.user_engagement.file_type_counts[type] || 0}건)`, '-']);
    });
    wsData.push([]);

    // 시스템 성능 지표
    wsData.push(['2. 시스템 성능 지표']);
    wsData.push(['지표', '값', '목표']);
    wsData.push(['분석 성공률 (%)', kpiData.system_performance.success_rate, kpiData.targets.success_rate]);
    wsData.push(['분석 실패율 (%)', kpiData.system_performance.failure_rate, kpiData.targets.failure_rate]);
    wsData.push(['완료된 분석 수', kpiData.system_performance.completed_count, '-']);
    wsData.push(['실패한 분석 수', kpiData.system_performance.failed_count, '-']);
    if (kpiData.system_performance.avg_processing_time_seconds !== null) {
      wsData.push(['평균 처리 시간 (초)', kpiData.system_performance.avg_processing_time_seconds, '-']);
    }
    Object.entries(kpiData.system_performance.avg_processing_time_by_type || {}).forEach(([type, time]) => {
      wsData.push([`  ${type} 평균 처리 시간 (초)`, time, '-']);
    });
    wsData.push([]);

    // AI 분석 품질 지표
    wsData.push(['3. AI 분석 품질 지표']);
    wsData.push(['지표', '값', '목표']);
    if (kpiData.ai_analysis_quality.avg_analysis_length !== null) {
      wsData.push(['평균 분석 결과 길이 (자)', kpiData.ai_analysis_quality.avg_analysis_length, '500-2000']);
    }
    wsData.push(['분석 항목 커버리지 (%)', kpiData.ai_analysis_quality.coverage_rate, kpiData.targets.coverage_rate]);
    wsData.push(['완료된 분석 수', kpiData.ai_analysis_quality.completed_analyses, '-']);
    wsData.push([]);

    // 기술적 지표
    wsData.push(['4. 기술적 지표']);
    wsData.push(['지표', '값', '목표']);
    if (kpiData.technical_metrics.db_size_mb !== null) {
      wsData.push(['데이터베이스 크기 (MB)', kpiData.technical_metrics.db_size_mb, '100']);
    }
    wsData.push(['Supabase 업로드 성공률 (%)', kpiData.technical_metrics.supabase_success_rate, '95']);
    wsData.push(['총 파일 수', kpiData.technical_metrics.total_files, '-']);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'KPI 리포트');

    const fileName = `KPI_리포트_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const exportToPDF = async () => {
    if (!kpiData) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // 한글 폰트 매핑 (영어로 변환)
    const koreanToEnglish = {
      '고객 상담 코칭 시스템 KPI 리포트': 'Customer Service Coaching KPI Report',
      '생성일시': 'Generated',
      '기간': 'Period',
      '전체': 'All',
      '일간': 'Daily',
      '주간': 'Weekly',
      '월간': 'Monthly',
      '사용자 활동 지표': 'User Engagement Metrics',
      '지표': 'Metric',
      '값': 'Value',
      '목표': 'Target',
      '전체 상담 수': 'Total Consultations',
      '일일 업로드 수': 'Daily Uploads',
      '주간 업로드 수': 'Weekly Uploads',
      '월간 업로드 수': 'Monthly Uploads',
      '일일 활성 사용자 (DAU)': 'Daily Active Users (DAU)',
      '주간 활성 사용자 (WAU)': 'Weekly Active Users (WAU)',
      '재방문율 (%)': 'Return Rate (%)',
      '파일 타입별 분포': 'File Type Distribution',
      '파일 타입': 'File Type',
      '비율': 'Percentage',
      '건수': 'Count',
      '시스템 성능 지표': 'System Performance Metrics',
      '분석 성공률 (%)': 'Analysis Success Rate (%)',
      '분석 실패율 (%)': 'Analysis Failure Rate (%)',
      '실패한 분석 수': 'Failed Analyses',
      '평균 처리 시간 (초)': 'Avg Processing Time (sec)',
      'AI 분석 품질 지표': 'AI Analysis Quality Metrics',
      '평균 분석 결과 길이 (자)': 'Avg Analysis Length (chars)',
      '분석 항목 커버리지 (%)': 'Analysis Coverage (%)',
      '완료된 분석 수': 'Completed Analyses',
      '기술적 지표': 'Technical Metrics',
      '데이터베이스 크기 (MB)': 'Database Size (MB)',
      'Supabase 업로드 성공률 (%)': 'Supabase Upload Success Rate (%)',
      '총 파일 수': 'Total Files',
    };
    
    const translate = (text) => koreanToEnglish[text] || text;
    
    let yPos = 20;

    // 제목
    doc.setFontSize(18);
    doc.setTextColor(102, 126, 234);
    doc.text(translate('고객 상담 코칭 시스템 KPI 리포트'), 14, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const periodText = period === 'all' ? 'All' : period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Monthly';
    doc.text(`${translate('생성일시')}: ${new Date().toLocaleString('en-US')}`, 14, yPos);
    yPos += 5;
    doc.text(`${translate('기간')}: ${periodText}`, 14, yPos);
    yPos += 10;

    // 사용자 활동 지표
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`1. ${translate('사용자 활동 지표')}`, 14, yPos);
    yPos += 8;

    const userEngagementData = [
      [translate('지표'), translate('값'), translate('목표')],
      [translate('전체 상담 수'), String(kpiData.user_engagement.total_consultations), '-'],
    ];

    if (kpiData.user_engagement.daily_consultations !== null) {
      userEngagementData.push([translate('일일 업로드 수'), String(kpiData.user_engagement.daily_consultations), String(kpiData.targets.daily_consultations)]);
    }
    if (kpiData.user_engagement.weekly_consultations !== null) {
      userEngagementData.push([translate('주간 업로드 수'), String(kpiData.user_engagement.weekly_consultations), String(kpiData.targets.weekly_consultations)]);
    }
    if (kpiData.user_engagement.monthly_consultations !== null) {
      userEngagementData.push([translate('월간 업로드 수'), String(kpiData.user_engagement.monthly_consultations), String(kpiData.targets.monthly_consultations)]);
    }
    if (kpiData.user_engagement.dau !== null) {
      userEngagementData.push([translate('일일 활성 사용자 (DAU)'), String(kpiData.user_engagement.dau), '-']);
    }
    if (kpiData.user_engagement.wau !== null) {
      userEngagementData.push([translate('주간 활성 사용자 (WAU)'), String(kpiData.user_engagement.wau), '-']);
    }
    if (kpiData.user_engagement.return_rate !== null) {
      userEngagementData.push([translate('재방문율 (%)'), `${kpiData.user_engagement.return_rate}%`, '40%']);
    }

    autoTable(doc, {
      startY: yPos,
      head: [userEngagementData[0]],
      body: userEngagementData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [102, 126, 234] },
    });
    yPos = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : yPos + 50;

    // 파일 타입별 분포
    if (Object.keys(kpiData.user_engagement.file_type_distribution).length > 0) {
      doc.setFontSize(12);
      doc.text(translate('파일 타입별 분포'), 14, yPos);
      yPos += 8;

      const fileTypeData = [
        [translate('파일 타입'), translate('비율'), translate('건수')],
      ];
      Object.entries(kpiData.user_engagement.file_type_distribution).forEach(([type, percentage]) => {
        fileTypeData.push([type, `${percentage}%`, String(kpiData.user_engagement.file_type_counts[type] || 0)]);
      });

      autoTable(doc, {
        startY: yPos,
        head: [fileTypeData[0]],
        body: fileTypeData.slice(1),
        theme: 'striped',
        headStyles: { fillColor: [102, 126, 234] },
      });
      yPos = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : yPos + 50;
    }

    // 시스템 성능 지표
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text(`2. ${translate('시스템 성능 지표')}`, 14, yPos);
    yPos += 8;

    const systemPerformanceData = [
      [translate('지표'), translate('값'), translate('목표')],
      [translate('분석 성공률 (%)'), `${kpiData.system_performance.success_rate}%`, `${kpiData.targets.success_rate}%`],
      [translate('분석 실패율 (%)'), `${kpiData.system_performance.failure_rate}%`, `${kpiData.targets.failure_rate}%`],
      [translate('완료된 분석 수'), String(kpiData.system_performance.completed_count), '-'],
      [translate('실패한 분석 수'), String(kpiData.system_performance.failed_count), '-'],
    ];

    if (kpiData.system_performance.avg_processing_time_seconds !== null) {
      systemPerformanceData.push([translate('평균 처리 시간 (초)'), String(kpiData.system_performance.avg_processing_time_seconds), '-']);
    }

    autoTable(doc, {
      startY: yPos,
      head: [systemPerformanceData[0]],
      body: systemPerformanceData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [102, 126, 234] },
    });
    yPos = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : yPos + 50;

    // AI 분석 품질 지표
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text(`3. ${translate('AI 분석 품질 지표')}`, 14, yPos);
    yPos += 8;

    const aiQualityData = [
      [translate('지표'), translate('값'), translate('목표')],
    ];

    if (kpiData.ai_analysis_quality.avg_analysis_length !== null) {
      aiQualityData.push([translate('평균 분석 결과 길이 (자)'), String(kpiData.ai_analysis_quality.avg_analysis_length), '500-2000']);
    }
    aiQualityData.push([translate('분석 항목 커버리지 (%)'), `${kpiData.ai_analysis_quality.coverage_rate}%`, `${kpiData.targets.coverage_rate}%`]);
    aiQualityData.push([translate('완료된 분석 수'), String(kpiData.ai_analysis_quality.completed_analyses), '-']);

    autoTable(doc, {
      startY: yPos,
      head: [aiQualityData[0]],
      body: aiQualityData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [102, 126, 234] },
    });
    yPos = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : yPos + 50;

    // 기술적 지표
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text(`4. ${translate('기술적 지표')}`, 14, yPos);
    yPos += 8;

    const technicalData = [
      [translate('지표'), translate('값'), translate('목표')],
    ];

    if (kpiData.technical_metrics.db_size_mb !== null) {
      technicalData.push([translate('데이터베이스 크기 (MB)'), String(kpiData.technical_metrics.db_size_mb), '100']);
    }
    technicalData.push([translate('Supabase 업로드 성공률 (%)'), `${kpiData.technical_metrics.supabase_success_rate}%`, '95%']);
    technicalData.push([translate('총 파일 수'), String(kpiData.technical_metrics.total_files), '-']);

    autoTable(doc, {
      startY: yPos,
      head: [technicalData[0]],
      body: technicalData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [102, 126, 234] },
    });

    const fileName = `KPI_리포트_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="header-content">
          <div className="header-logo">
            <Logo size="small" showText={true} />
            <span className="admin-badge">관리자</span>
          </div>
          <div className="header-right">
            {user && (
              <div className="user-info">
                <span className="user-name">{user.username}</span>
                {user.email && <span className="user-email">{user.email}</span>}
              </div>
            )}
            <button onClick={() => navigate('/dashboard')} className="dashboard-btn" title="일반 대시보드">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              <span>일반</span>
            </button>
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

      <main className="admin-main">
        <div className="admin-controls">
          <div className="period-selector">
            <label>기간 선택:</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} disabled={loading}>
              <option value="all">전체</option>
              <option value="daily">일간</option>
              <option value="weekly">주간</option>
              <option value="monthly">월간</option>
            </select>
          </div>
          <div className="date-range">
            <label>시작일:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              disabled={loading}
            />
            <label>종료일:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              disabled={loading}
            />
          </div>
          <button onClick={loadKPIData} className="refresh-btn" disabled={loading} title="새로고침">
            {loading ? '⏳' : '🔄'}
          </button>
          {kpiData && (
            <div className="export-buttons">
              <button onClick={exportToExcel} className="export-btn excel-btn" title="엑셀 다운로드">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>엑셀</span>
              </button>
              <button onClick={exportToPDF} className="export-btn pdf-btn" title="PDF 다운로드">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <span>PDF</span>
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="error-message">
            <h2>오류 발생</h2>
            <p>{error}</p>
            <button onClick={loadKPIData}>다시 시도</button>
          </div>
        )}

        {loading && !kpiData ? (
          <div className="kpi-loading">
            <div className="loading-spinner"></div>
            <p>KPI 데이터를 불러오는 중...</p>
          </div>
        ) : kpiData && (
          <>
            {/* 사용자 활동 지표 */}
            <section className="kpi-section">
              <h2>📊 사용자 활동 지표</h2>
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-label">전체 상담 수</div>
                  <div className="kpi-value">{formatNumber(kpiData.user_engagement.total_consultations)}</div>
                </div>
                {kpiData.user_engagement.daily_consultations !== null && (
                  <div className="kpi-card">
                    <div className="kpi-label">일일 업로드 수</div>
                    <div className={`kpi-value ${getStatusColor(kpiData.user_engagement.daily_consultations, kpiData.targets.daily_consultations)}`}>
                      {formatNumber(kpiData.user_engagement.daily_consultations)}
                    </div>
                    <div className="kpi-target">목표: {kpiData.targets.daily_consultations}건</div>
                  </div>
                )}
                {kpiData.user_engagement.weekly_consultations !== null && (
                  <div className="kpi-card">
                    <div className="kpi-label">주간 업로드 수</div>
                    <div className={`kpi-value ${getStatusColor(kpiData.user_engagement.weekly_consultations, kpiData.targets.weekly_consultations)}`}>
                      {formatNumber(kpiData.user_engagement.weekly_consultations)}
                    </div>
                    <div className="kpi-target">목표: {kpiData.targets.weekly_consultations}건</div>
                  </div>
                )}
                {kpiData.user_engagement.monthly_consultations !== null && (
                  <div className="kpi-card">
                    <div className="kpi-label">월간 업로드 수</div>
                    <div className={`kpi-value ${getStatusColor(kpiData.user_engagement.monthly_consultations, kpiData.targets.monthly_consultations)}`}>
                      {formatNumber(kpiData.user_engagement.monthly_consultations)}
                    </div>
                    <div className="kpi-target">목표: {kpiData.targets.monthly_consultations}건</div>
                  </div>
                )}
                {kpiData.user_engagement.dau !== null && (
                  <div className="kpi-card">
                    <div className="kpi-label">일일 활성 사용자 (DAU)</div>
                    <div className="kpi-value">{formatNumber(kpiData.user_engagement.dau)}</div>
                  </div>
                )}
                {kpiData.user_engagement.wau !== null && (
                  <div className="kpi-card">
                    <div className="kpi-label">주간 활성 사용자 (WAU)</div>
                    <div className="kpi-value">{formatNumber(kpiData.user_engagement.wau)}</div>
                  </div>
                )}
                {kpiData.user_engagement.return_rate !== null && (
                  <div className="kpi-card">
                    <div className="kpi-label">재방문율</div>
                    <div className={`kpi-value ${getStatusColor(kpiData.user_engagement.return_rate, 40)}`}>
                      {formatNumber(kpiData.user_engagement.return_rate)}%
                    </div>
                    <div className="kpi-target">목표: 40%</div>
                  </div>
                )}
              </div>
              <div className="file-type-distribution">
                <h3>파일 타입별 분포</h3>
                <div className="distribution-chart">
                  {Object.entries(kpiData.user_engagement.file_type_distribution).map(([type, percentage]) => (
                    <div key={type} className="distribution-item">
                      <span className="distribution-label">{type}</span>
                      <div className="distribution-bar">
                        <div
                          className="distribution-fill"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="distribution-value">{percentage}% ({kpiData.user_engagement.file_type_counts[type] || 0}건)</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 시스템 성능 지표 */}
            <section className="kpi-section">
              <h2>⚡ 시스템 성능 지표</h2>
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-label">분석 성공률</div>
                  <div className={`kpi-value ${getStatusColor(kpiData.system_performance.success_rate, kpiData.targets.success_rate)}`}>
                    {formatNumber(kpiData.system_performance.success_rate)}%
                  </div>
                  <div className="kpi-target">목표: {kpiData.targets.success_rate}%</div>
                  <div className="kpi-detail">완료: {kpiData.system_performance.completed_count}건</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">분석 실패율</div>
                  <div className={`kpi-value ${getStatusColor(kpiData.system_performance.failure_rate, kpiData.targets.failure_rate, true)}`}>
                    {formatNumber(kpiData.system_performance.failure_rate)}%
                  </div>
                  <div className="kpi-target">목표: {kpiData.targets.failure_rate}% 이하</div>
                  <div className="kpi-detail">실패: {kpiData.system_performance.failed_count}건</div>
                </div>
                {kpiData.system_performance.avg_processing_time_seconds !== null && (
                  <div className="kpi-card">
                    <div className="kpi-label">평균 처리 시간</div>
                    <div className="kpi-value">
                      {formatSeconds(kpiData.system_performance.avg_processing_time_seconds)}
                    </div>
                    <div className="kpi-detail">
                      {Object.entries(kpiData.system_performance.avg_processing_time_by_type || {}).map(([type, time]) => (
                        <div key={type}>{type}: {formatSeconds(time)}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* AI 분석 품질 지표 */}
            <section className="kpi-section">
              <h2>🤖 AI 분석 품질 지표</h2>
              <div className="kpi-grid">
                {kpiData.ai_analysis_quality.avg_analysis_length !== null && (
                  <div className="kpi-card">
                    <div className="kpi-label">평균 분석 결과 길이</div>
                    <div className="kpi-value">{formatNumber(kpiData.ai_analysis_quality.avg_analysis_length)}자</div>
                    <div className="kpi-target">목표: 500-2000자</div>
                  </div>
                )}
                <div className="kpi-card">
                  <div className="kpi-label">분석 항목 커버리지</div>
                  <div className={`kpi-value ${getStatusColor(kpiData.ai_analysis_quality.coverage_rate, kpiData.targets.coverage_rate)}`}>
                    {formatNumber(kpiData.ai_analysis_quality.coverage_rate)}%
                  </div>
                  <div className="kpi-target">목표: {kpiData.targets.coverage_rate}%</div>
                  <div className="kpi-detail">완료된 분석: {kpiData.ai_analysis_quality.completed_analyses}건</div>
                </div>
              </div>
            </section>

            {/* 기술적 지표 */}
            <section className="kpi-section">
              <h2>🔧 기술적 지표</h2>
              <div className="kpi-grid">
                {kpiData.technical_metrics.db_size_mb !== null && (
                  <div className="kpi-card">
                    <div className="kpi-label">데이터베이스 크기</div>
                    <div className="kpi-value">{formatNumber(kpiData.technical_metrics.db_size_mb)} MB</div>
                    <div className="kpi-target">목표: 100MB 이하</div>
                  </div>
                )}
                <div className="kpi-card">
                  <div className="kpi-label">Supabase 업로드 성공률</div>
                  <div className={`kpi-value ${getStatusColor(kpiData.technical_metrics.supabase_success_rate, 95)}`}>
                    {formatNumber(kpiData.technical_metrics.supabase_success_rate)}%
                  </div>
                  <div className="kpi-target">목표: 95% 이상</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">총 파일 수</div>
                  <div className="kpi-value">{formatNumber(kpiData.technical_metrics.total_files)}</div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
