# Frontend - React 프로젝트

## 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정 (선택사항)
`.env` 파일을 생성하고 다음 내용을 추가하세요:

```
REACT_APP_API_URL=http://localhost:8000/api
```

### 3. 개발 서버 실행
```bash
npm start
```

브라우저에서 `http://localhost:3000`으로 접속하세요.

## 주요 기능

- 상담 파일 업로드 (텍스트, 오디오, 비디오)
- 실시간 분석 진행 상황 확인 (SSE)
- 분석 결과 조회
- 상담 목록 관리
