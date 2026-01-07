# 고객 상담 프로그램 (Customer Service Coaching)

고객 상담 대화 내용 및 녹화 파일을 업로드하고, 개선 사항을 분석하는 프로그램입니다.

## 프로젝트 개요

이 프로젝트는 고객 상담 품질 향상을 위해 대화 내용과 녹화 파일을 분석하고, 개선이 필요한 사항을 도출하는 시스템입니다.

## 프로젝트 구조

```
customer-service-coaching/
├── backend/          # 백엔드 프로젝트
├── frontend/         # 프론트엔드 프로젝트
└── README.md
```

## 주요 기능

### 1. 파일 업로드
- 대화 내용 파일 업로드 (텍스트, 음성 전사본 등)
- 녹화 파일 업로드 (오디오, 비디오 등)
- 다양한 파일 형식 지원

### 2. 상담 분석
- 업로드된 대화/녹화 내용 분석
- 개선이 필요한 사항 자동 도출
- 분석 결과 제공

## 기술 스택

### Backend
- **Django**: 웹 프레임워크
- **Celery**: 비동기 작업 처리
- **Redis**: Celery 브로커 및 캐시
- **OpenAI API**: 상담 내용 분석
- **Django REST Framework**: API 개발
- **drf-yasg**: Swagger/OpenAPI 문서화
- **SSE (Server-Sent Events)**: 실시간 알림

### Frontend
- **React**: UI 프레임워크
- **EventSource API**: SSE 클라이언트

## 아키텍처

```
사용자 → React (프론트엔드)
         ↓
    Django API (백엔드)
         ↓
    Celery (비동기 작업)
         ↓
    OpenAI API (분석)
         ↓
    SSE (알림) → React
```

## 시작하기

### 사전 요구사항
- Python 3.8+
- Node.js 16+
- Redis
- OpenAI API Key

### 설치 및 실행

#### Backend 설정
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

#### Celery Worker 실행
```bash
cd backend
celery -A config worker -l info
```

#### Redis 실행
```bash
redis-server
```

#### Frontend 설정
```bash
cd frontend
npm install
npm start
```

## 개발 계획

1. [x] 백엔드 프로젝트 초기 설정
2. [x] 프론트엔드 프로젝트 초기 설정
3. [x] 파일 업로드 기능 구현
4. [x] 상담 내용 분석 기능 구현 (Celery + OpenAI)
5. [x] 분석 결과 제공 기능 구현 (SSE)

## 환경 변수 설정

### Backend
`backend/.env` 파일을 생성하고 다음 내용을 추가하세요:
```
OPENAI_API_KEY=your_openai_api_key_here
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

### Frontend (선택사항)
`frontend/.env` 파일을 생성하고 다음 내용을 추가하세요:
```
REACT_APP_API_URL=http://localhost:8000/api
```

## 실행 순서

1. Redis 서버 실행
2. Django 서버 실행 (`python manage.py runserver`)
3. Celery Worker 실행 (`celery -A config worker -l info`)
4. React 개발 서버 실행 (`npm start`)

## API 문서

Django 서버 실행 후 다음 URL에서 Swagger API 문서를 확인할 수 있습니다:

- **Swagger UI**: http://localhost:8000/swagger/
- **ReDoc**: http://localhost:8000/redoc/

## 라이선스

(추후 결정)

