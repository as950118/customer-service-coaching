"""
Supabase Storage를 사용한 파일 업로드 유틸리티
"""
from supabase import create_client, Client
from django.conf import settings
import os
from pathlib import Path


def upload_to_supabase(file_path: str, file_name: str) -> str:
    """
    파일을 Supabase Storage에 업로드하고 공개 URL 반환
    
    Args:
        file_path: 로컬 파일 경로
        file_name: Supabase에 저장할 파일명
        
    Returns:
        공개 URL
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        print("Supabase 설정이 없습니다. 로컬 저장만 사용합니다.")
        print(f"SUPABASE_URL: {settings.SUPABASE_URL}")
        print(f"SUPABASE_KEY exists: {bool(settings.SUPABASE_KEY)}")
        return None
    
    try:
        print(f"Supabase 클라이언트 생성 중... URL: {settings.SUPABASE_URL}, Bucket: {settings.SUPABASE_STORAGE_BUCKET}")
        supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        
        # 파일 읽기
        with open(file_path, 'rb') as f:
            file_data = f.read()
        
        # MIME 타입 추정
        import mimetypes
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = "application/octet-stream"
        
        # Supabase Storage에 업로드
        print(f"파일 업로드 중: {file_name} ({len(file_data)} bytes)")
        
        # 파일이 이미 존재할 수 있으므로 먼저 삭제 시도
        try:
            supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).remove([file_name])
            print(f"기존 파일 삭제: {file_name}")
        except Exception:
            # 파일이 없어도 계속 진행
            pass
        
        # 파일 업로드
        response = supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).upload(
            file_name,
            file_data,
            file_options={"content-type": mime_type}
        )
        print(f"Supabase 업로드 응답: {response}")
        
        # 공개 URL 생성
        public_url = supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).get_public_url(file_name)
        
        print(f"Supabase 업로드 성공: {public_url}")
        return public_url
    except Exception as e:
        print(f"Supabase 업로드 실패: {e}")
        import traceback
        traceback.print_exc()
        return None

