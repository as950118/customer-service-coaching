FROM python:3.9-slim

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 패키지 업데이트 및 필요한 패키지 설치
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 파일 복사
COPY requirements.txt .

# Python 패키지 설치
RUN pip install --no-cache-dir -r requirements.txt

# 프로젝트 파일 복사
COPY . .

# 미디어 디렉토리 생성
RUN mkdir -p /app/media

# 포트 노출 (Django 기본 포트)
EXPOSE 8000

# 기본 명령어 (docker-compose에서 오버라이드됨)
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

