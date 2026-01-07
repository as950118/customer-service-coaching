# Backend - Django 프로젝트

## 설정

### 1. 가상환경 활성화
```bash
source venv/bin/activate  # Windows: venv\Scripts\activate
```

### 2. 환경 변수 설정
`.env` 파일을 생성하고 다음 내용을 추가하세요:

```
OPENAI_API_KEY=your_openai_api_key_here
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

### 3. 데이터베이스 마이그레이션
```bash
python manage.py migrate
```

### 4. 서버 실행
```bash
python manage.py runserver
```

## Celery Worker 실행

별도 터미널에서:
```bash
celery -A config worker -l info
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

