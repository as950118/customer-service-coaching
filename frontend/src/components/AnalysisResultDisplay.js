import React from 'react';
import './AnalysisResultDisplay.css';

function AnalysisResultDisplay({ analysisResult }) {
  let parsedResult;
  
  try {
    // analysis_result가 문자열인 경우 JSON 파싱
    if (typeof analysisResult === 'string') {
      parsedResult = JSON.parse(analysisResult);
    } else {
      parsedResult = analysisResult;
    }
  } catch (e) {
    // JSON 파싱 실패 시 원본 텍스트로 표시
    return (
      <div className="detail-section">
        <h2 className="section-title">분석 결과</h2>
        <div className="content-box analysis-content-box">
          <pre className="content-text">{analysisResult}</pre>
        </div>
      </div>
    );
  }

  const getScoreColor = (score) => {
    if (score >= 8) return '#28a745';
    if (score >= 6) return '#ffc107';
    return '#dc3545';
  };

  const getPriorityColor = (priority) => {
    if (priority === 'high') return '#dc3545';
    if (priority === 'medium') return '#ffc107';
    return '#17a2b8';
  };

  const getPriorityText = (priority) => {
    if (priority === 'high') return '높음';
    if (priority === 'medium') return '보통';
    return '낮음';
  };

  return (
    <div className="analysis-result-container">
      <div className="detail-section">
        <h2 className="section-title">분석 결과</h2>
      </div>

      {/* 전체 점수 및 요약 */}
      <div className="detail-section">
        <div className="overall-score-card">
          <div className="overall-score-circle">
            <div className="score-number">{parsedResult.overall_score || '-'}</div>
            <div className="score-label">종합 점수</div>
          </div>
          <div className="overall-feedback">
            <h3>전체 피드백</h3>
            <p>{parsedResult.overall_feedback}</p>
          </div>
        </div>
      </div>

      {/* 요약 */}
      {parsedResult.summary && (
        <div className="detail-section">
          <h3 className="subsection-title">📋 요약</h3>
          <div className="summary-box">
            <p>{parsedResult.summary}</p>
          </div>
        </div>
      )}

      {/* 평가 항목들 */}
      <div className="detail-section">
        <h3 className="subsection-title">📊 상세 평가</h3>
        <div className="evaluation-grid">
          {/* 고객 응대 태도 */}
          {parsedResult.customer_service_attitude && (
            <div className="evaluation-card">
              <div className="evaluation-header">
                <h4>고객 응대 태도</h4>
                <div 
                  className="score-badge"
                  style={{ backgroundColor: getScoreColor(parsedResult.customer_service_attitude.score) }}
                >
                  {parsedResult.customer_service_attitude.score}점
                </div>
              </div>
              <div className="evaluation-content">
                <div className="strengths-section">
                  <h5>✅ 강점</h5>
                  <ul>
                    {parsedResult.customer_service_attitude.strengths?.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="weaknesses-section">
                  <h5>⚠️ 개선점</h5>
                  <ul>
                    {parsedResult.customer_service_attitude.weaknesses?.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                {parsedResult.customer_service_attitude.details && (
                  <div className="details-section">
                    <p>{parsedResult.customer_service_attitude.details}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 문제 해결 능력 */}
          {parsedResult.problem_solving && (
            <div className="evaluation-card">
              <div className="evaluation-header">
                <h4>문제 해결 능력</h4>
                <div 
                  className="score-badge"
                  style={{ backgroundColor: getScoreColor(parsedResult.problem_solving.score) }}
                >
                  {parsedResult.problem_solving.score}점
                </div>
              </div>
              <div className="evaluation-content">
                <div className="strengths-section">
                  <h5>✅ 강점</h5>
                  <ul>
                    {parsedResult.problem_solving.strengths?.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="weaknesses-section">
                  <h5>⚠️ 개선점</h5>
                  <ul>
                    {parsedResult.problem_solving.weaknesses?.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                {parsedResult.problem_solving.details && (
                  <div className="details-section">
                    <p>{parsedResult.problem_solving.details}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 커뮤니케이션 스킬 */}
          {parsedResult.communication_skills && (
            <div className="evaluation-card">
              <div className="evaluation-header">
                <h4>커뮤니케이션 스킬</h4>
                <div 
                  className="score-badge"
                  style={{ backgroundColor: getScoreColor(parsedResult.communication_skills.score) }}
                >
                  {parsedResult.communication_skills.score}점
                </div>
              </div>
              <div className="evaluation-content">
                <div className="strengths-section">
                  <h5>✅ 강점</h5>
                  <ul>
                    {parsedResult.communication_skills.strengths?.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="weaknesses-section">
                  <h5>⚠️ 개선점</h5>
                  <ul>
                    {parsedResult.communication_skills.weaknesses?.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                {parsedResult.communication_skills.details && (
                  <div className="details-section">
                    <p>{parsedResult.communication_skills.details}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 개선 권장사항 */}
      {parsedResult.improvement_recommendations && parsedResult.improvement_recommendations.length > 0 && (
        <div className="detail-section">
          <h3 className="subsection-title">💡 개선 권장사항</h3>
          <div className="recommendations-list">
            {parsedResult.improvement_recommendations.map((rec, idx) => (
              <div key={idx} className="recommendation-card">
                <div className="recommendation-header">
                  <span className="recommendation-category">{rec.category}</span>
                  <span 
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(rec.priority) }}
                  >
                    {getPriorityText(rec.priority)}
                  </span>
                </div>
                <div className="recommendation-content">
                  <div className="recommendation-issue">
                    <strong>이슈:</strong> {rec.issue}
                  </div>
                  <div className="recommendation-text">
                    <strong>권장사항:</strong> {rec.recommendation}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalysisResultDisplay;

