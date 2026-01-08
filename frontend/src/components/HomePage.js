import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

function HomePage() {
  return (
    <div className="home-page">
      <div className="home-hero">
        <div className="hero-content">
          <h1 className="hero-title">고객 상담 코칭 시스템</h1>
          <p className="hero-subtitle">
            AI 기반 상담 분석으로 고객 서비스 품질을 향상시키세요
          </p>
          <div className="hero-buttons">
            <Link to="/login" className="btn btn-primary">
              로그인
            </Link>
            <Link to="/signup" className="btn btn-secondary">
              회원가입
            </Link>
          </div>
        </div>
      </div>

      <div className="home-features">
        <div className="container">
          <h2 className="features-title">주요 기능</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>상담 분석</h3>
              <p>
                상담 녹화 파일을 업로드하면 AI가 자동으로 대화 내용을 분석하고
                개선 사항을 제안합니다.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💡</div>
              <h3>코칭 제안</h3>
              <p>
                분석 결과를 바탕으로 구체적인 코칭 포인트와 개선 방안을
                제공합니다.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>성과 추적</h3>
              <p>
                상담 품질 지표를 추적하고 관리하여 지속적인 개선이 가능합니다.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>안전한 보관</h3>
              <p>
                모든 상담 데이터는 안전하게 저장되며, 개인정보 보호 규정을
                준수합니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="home-how-it-works">
        <div className="container">
          <h2 className="section-title">사용 방법</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>회원가입</h3>
              <p>간단한 정보로 계정을 만드세요</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>상담 파일 업로드</h3>
              <p>녹화된 상담 파일을 업로드하세요</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>AI 분석</h3>
              <p>자동으로 대화 내용을 분석합니다</p>
            </div>
            <div className="step">
              <div className="step-number">4</div>
              <h3>결과 확인</h3>
              <p>분석 결과와 코칭 제안을 확인하세요</p>
            </div>
          </div>
        </div>
      </div>

      <div className="home-cta">
        <div className="container">
          <h2>지금 시작하세요</h2>
          <p>더 나은 고객 서비스를 위한 첫 걸음을 내딛어보세요</p>
          <Link to="/signup" className="btn btn-primary btn-large">
            무료로 시작하기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default HomePage;

