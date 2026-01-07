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
- **Google Gemini API**: 상담 내용 분석 (multimodal 지원)
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
- Redis (Celery 브로커용) - Docker 사용 시 Docker만 필요
- Google Gemini API Key
- Docker & Docker Compose (선택사항, Redis용)

#### Redis 설치

**Docker 사용 (추천):**
```bash
# Docker Compose로 Redis 실행
docker-compose up -d redis
```

**직접 설치:**

**macOS (Homebrew):**
```bash
brew install redis
brew services start redis  # 자동 시작 설정
# 또는 수동 실행: redis-server
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
```

**Windows:**
- [Redis for Windows](https://github.com/microsoftarchive/redis/releases) 다운로드
- 또는 WSL2 사용

**Docker 사용:**
```bash
docker run -d -p 6379:6379 redis:latest
```

Redis 설치 확인:
```bash
redis-cli ping  # "PONG" 응답이 오면 정상
```

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

**방법 1: 실행 스크립트 사용 (추천)**
```bash
cd backend
./start_celery.sh
```

**방법 2: 직접 실행**
```bash
cd backend
source venv/bin/activate
celery -A config worker -l info
```

**참고**: 
- 환경 변수는 `backend/.env` 파일에서 자동으로 로드됩니다 (별도 설정 불필요)
- Celery Worker는 별도 터미널에서 실행해야 합니다

#### Redis 실행

**방법 1: Docker 사용 (추천)**
```bash
# Docker Compose로 Redis 실행
docker-compose up -d redis

# Redis 상태 확인
docker-compose ps

# Redis 로그 확인
docker-compose logs redis

# Redis 중지
docker-compose stop redis
```

**방법 2: 직접 설치 및 실행**
Redis가 설치되어 있다면:
```bash
redis-server
```

Redis가 설치되어 있지 않다면 위의 "사전 요구사항" 섹션을 참고하여 먼저 설치하세요.

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
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash  # 기본값: gemini-1.5-flash (빠르고 저렴)

# Supabase Storage (선택사항 - 파일을 클라우드에 저장하려면)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key  # service_role key 사용 (서버용)
SUPABASE_STORAGE_BUCKET=consultations

CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

**모델 선택:**
- `gemini-1.5-flash` (기본값): 빠르고 저렴, multimodal 지원
- `gemini-1.5-pro`: 더 높은 성능 필요 시, multimodal 지원

**Gemini API 키 발급:**
1. [Google AI Studio](https://makersuite.google.com/app/apikey) 접속
2. API 키 생성
3. `.env` 파일에 추가

### Frontend (선택사항)
`frontend/.env` 파일을 생성하고 다음 내용을 추가하세요:
```
REACT_APP_API_URL=http://localhost:8000/api
```

## 실행 순서

### Docker를 사용하는 경우 (추천)

1. **Redis 실행 (Docker)**
   ```bash
   docker-compose up -d redis
   ```

2. **Django 서버 실행**
   ```bash
   cd backend
   source venv/bin/activate
   python manage.py runserver
   ```

3. **Celery Worker 실행** (별도 터미널)
   ```bash
   cd backend
   ./start_celery.sh
   # 또는
   source venv/bin/activate
   celery -A config worker -l info
   ```

4. **React 개발 서버 실행** (별도 터미널)
   ```bash
   cd frontend
   npm start
   ```

**중요**: 
- Celery Worker는 **별도 터미널**에서 실행해야 합니다
- 환경 변수는 `backend/.env` 파일에서 자동으로 로드되므로 별도 설정이 필요 없습니다

### Docker를 사용하지 않는 경우

1. Redis 서버 실행 (`redis-server` 또는 `brew services start redis`)
2. Django 서버 실행 (`python manage.py runserver`)
3. Celery Worker 실행 (`celery -A config worker -l info`)
4. React 개발 서버 실행 (`npm start`)

## API 문서

Django 서버 실행 후 다음 URL에서 Swagger API 문서를 확인할 수 있습니다:

- **Swagger UI**: http://localhost:8000/swagger/
- **ReDoc**: http://localhost:8000/redoc/

## 테스트용 샘플 데이터

프로젝트 루트의 `sample_data/` 디렉토리에 테스트용 샘플 데이터가 포함되어 있습니다:

- **텍스트 파일**: 4개의 다양한 상담 시나리오 샘플
  - 배송 지연 및 환불 요청
  - 제품 불만 및 A/S 요청
  - 환불 및 교환 요청
  - 기술 지원 요청

- **오디오/비디오 파일**: 
  - OpenAI Whisper API를 사용하여 자동 전사
  - 지원 형식: MP3, WAV, M4A, OGG (오디오), MP4, AVI, MOV, WEBM (비디오)

샘플 데이터 사용 방법은 `sample_data/README.md`를 참고하세요.

## 지원 파일 형식

### 텍스트
- `.txt`, `.doc`, `.docx` 등 텍스트 파일

### 오디오
- MP3, WAV, M4A, OGG
- OpenAI Whisper API를 사용하여 자동 전사

### 비디오
- MP4, AVI, MOV, WEBM
- OpenAI Whisper API를 사용하여 오디오 추출 후 전사

## 라이선스

(추후 결정)

