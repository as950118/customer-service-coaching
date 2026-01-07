# Backend - Django 프로젝트

## 사전 요구사항

### Redis 설치 및 실행

Celery는 비동기 작업 처리를 위해 Redis가 필요합니다.

**macOS (Homebrew):**
```bash
brew install redis
brew services start redis  # 자동 시작 설정
```

**Redis 실행 확인:**
```bash
redis-cli ping  # "PONG" 응답이 오면 정상
```

## 설정

### 1. 가상환경 활성화
```bash
source venv/bin/activate  # Windows: venv\Scripts\activate
```

### 2. 환경 변수 설정
`.env` 파일을 생성하고 다음 내용을 추가하세요:

```
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini  # 기본값: gpt-4o-mini (비용 효율적), 다른 옵션: gpt-4o, gpt-4-turbo, gpt-4
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

**모델 선택 가이드:**
- `gpt-4o-mini`: 기본값, 비용 효율적이며 상담 분석에 충분한 성능 제공
- `gpt-4o`: 더 높은 성능이 필요한 경우
- `gpt-4-turbo`: 최고 성능이 필요한 경우
- `gpt-4`: 레거시 모델 (비추천)

### 3. 데이터베이스 마이그레이션
```bash
python manage.py migrate
```

### 4. 서버 실행
```bash
python manage.py runserver
```

## Redis 실행

### Docker 사용 (추천)
```bash
# 프로젝트 루트에서
docker-compose up -d redis
```

### 직접 설치
```bash
redis-server
```

## Celery Worker 실행

**별도 터미널에서 실행해야 합니다!**

### 방법 1: 실행 스크립트 사용 (추천)
```bash
./start_celery.sh
```

### 방법 2: 직접 실행
```bash
source venv/bin/activate
celery -A config worker -l info
```

**중요 사항:**
- ✅ **별도 터미널에서 실행**: Django 서버와는 다른 터미널이 필요합니다
- ✅ **환경 변수 자동 로드**: `backend/.env` 파일이 있으면 자동으로 로드됩니다 (별도 설정 불필요)
- ✅ **Redis 필요**: Redis가 실행 중이어야 Celery Worker가 정상 작동합니다

**실행 확인:**
Celery Worker가 정상적으로 실행되면 다음과 같은 메시지가 보입니다:
```
[tasks]
  . coaching.tasks.analyze_consultation

[INFO/MainProcess] Connected to redis://localhost:6379/0
[INFO/MainProcess] celery@hostname ready.
```

## API 엔드포인트

- `GET /api/consultations/` - 상담 목록 조회
- `POST /api/consultations/` - 상담 파일 업로드
- `GET /api/consultations/{id}/` - 상담 상세 조회
- `GET /api/consultations/{id}/stream/` - SSE 스트림 (분석 진행 상황)

## API 문서 (Swagger)

서버 실행 후 다음 URL에서 API 문서를 확인할 수 있습니다:

- **Swagger UI**: http://localhost:8000/swagger/
- **ReDoc**: http://localhost:8000/redoc/
- **JSON Schema**: http://localhost:8000/swagger.json
- **YAML Schema**: http://localhost:8000/swagger.yaml

