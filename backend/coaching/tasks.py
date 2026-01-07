from celery import shared_task
from django.utils import timezone
from django.conf import settings
from .models import Consultation
from .storage import upload_to_supabase
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
import os
import mimetypes
import time
from pathlib import Path


@shared_task
def analyze_consultation(consultation_id):
    """상담 내용을 분석하는 Celery 태스크"""
    try:
        consultation = Consultation.objects.get(id=consultation_id)
        consultation.status = 'processing'
        consultation.save()
        
        # Gemini API 설정
        genai.configure(api_key=settings.GEMINI_API_KEY)
        # 모델 이름이 'models/' 접두사 없이 제공되면 자동으로 추가됨
        model_name = settings.GEMINI_MODEL
        if not model_name.startswith('models/'):
            model_name = f'models/{model_name}'
        model = genai.GenerativeModel(model_name)
        
        file_path = consultation.file.path
        file_type = consultation.file_type
        
        # 프롬프트 구성
        system_prompt = "당신은 고객 상담 품질을 분석하는 전문가입니다."
        user_prompt = """다음 상담 내용을 분석하여 개선이 필요한 사항들을 도출해주세요.

다음 항목들을 중심으로 분석해주세요:
1. 고객 응대 태도
2. 문제 해결 능력
3. 커뮤니케이션 스킬
4. 개선이 필요한 구체적인 사항

분석 결과를 구조화된 형태로 제공해주세요."""
        
        # 원본 내용 저장을 위한 변수
        original_content = None
        
        # Gemini API 호출 헬퍼 함수 (재시도 로직 포함)
        def call_gemini_with_retry(prompt_or_content, max_retries=3, initial_delay=1):
            """
            Gemini API를 호출하고 할당량 초과 시 재시도
            
            Args:
                prompt_or_content: 프롬프트 문자열 또는 [프롬프트, 파일] 리스트
                max_retries: 최대 재시도 횟수
                initial_delay: 초기 재시도 대기 시간 (초)
            """
            for attempt in range(max_retries):
                try:
                    response = model.generate_content(prompt_or_content)
                    return response.text
                except google_exceptions.ResourceExhausted as e:
                    error_msg = str(e)
                    # 재시도 가능 시간 추출
                    retry_after = None
                    if "Please retry in" in error_msg:
                        try:
                            # "Please retry in 33.487629633s" 형식에서 숫자 추출
                            import re
                            match = re.search(r'Please retry in ([\d.]+)s', error_msg)
                            if match:
                                retry_after = float(match.group(1))
                        except:
                            pass
                    
                    if attempt < max_retries - 1:
                        wait_time = retry_after if retry_after else (initial_delay * (2 ** attempt))
                        print(f"할당량 초과. {wait_time:.1f}초 후 재시도 ({attempt + 1}/{max_retries})...")
                        time.sleep(wait_time)
                    else:
                        # 최대 재시도 횟수 초과
                        raise Exception(
                            f"Gemini API 할당량 초과: 무료 티어 할당량을 모두 사용했습니다.\n\n"
                            f"해결 방법:\n"
                            f"1. 잠시 후 다시 시도하세요 (보통 몇 분 후 재사용 가능)\n"
                            f"2. Google AI Studio에서 할당량 확인: https://ai.dev/usage?tab=rate-limit\n"
                            f"3. 유료 플랜으로 업그레이드 고려\n"
                            f"4. 더 작은 모델 사용 (gemini-2.0-flash-lite 등)\n\n"
                            f"원본 에러: {error_msg}"
                        )
                except Exception as e:
                    # 다른 에러는 즉시 재발생
                    raise
            
            # 이 코드는 실행되지 않아야 하지만 안전을 위해
            raise Exception("최대 재시도 횟수 초과")
        
        # 파일 타입에 따라 처리
        if file_type == 'text':
            # 텍스트 파일: 내용 읽기
            with open(file_path, 'r', encoding='utf-8') as f:
                file_content = f.read()
            
            # 원본 내용 저장
            original_content = file_content
            
            full_prompt = f"""{user_prompt}

상담 내용:
{file_content}"""
            
            analysis_result = call_gemini_with_retry(full_prompt)
            
        elif file_type in ['audio', 'video']:
            # 오디오/비디오 파일: Gemini가 직접 처리 (multimodal)
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                if file_type == 'audio':
                    mime_type = 'audio/mpeg'
                elif file_type == 'video':
                    mime_type = 'video/mp4'
            
            # 파일 읽기
            with open(file_path, 'rb') as f:
                file_data = f.read()
            
            file_part = {
                "mime_type": mime_type,
                "data": file_data
            }
            
            # 1단계: 먼저 전사만 수행
            transcription_prompt = "이 오디오/비디오 파일의 대화 내용을 정확하게 텍스트로 전사해주세요. 분석은 하지 말고 전사만 해주세요."
            original_content = call_gemini_with_retry([
                transcription_prompt,
                file_part
            ])
            
            # 2단계: 전사된 텍스트로 분석 수행
            full_prompt = f"""{user_prompt}

상담 내용 (전사본):
{original_content}"""
            
            analysis_result = call_gemini_with_retry(full_prompt)
            
        else:
            raise ValueError(f"지원하지 않는 파일 형식: {file_type}")
        
        # Supabase Storage에 파일 업로드 (선택사항)
        supabase_url = None
        if settings.SUPABASE_URL and settings.SUPABASE_KEY:
            try:
                file_name = f"consultation_{consultation_id}_{Path(file_path).name}"
                print(f"Supabase 업로드 시도: {file_name}")
                supabase_url = upload_to_supabase(file_path, file_name)
                if supabase_url:
                    print(f"Supabase 업로드 성공, URL: {supabase_url}")
                else:
                    print("Supabase 업로드 실패 (None 반환)")
            except Exception as e:
                print(f"Supabase 업로드 중 예외 발생: {e}")
                import traceback
                traceback.print_exc()
                # 업로드 실패해도 분석은 계속 진행
                supabase_url = None
        
        # 결과 저장
        consultation.original_content = original_content
        consultation.analysis_result = analysis_result
        consultation.supabase_file_url = supabase_url
        consultation.status = 'completed'
        consultation.completed_at = timezone.now()
        consultation.save()
        
        return f"Analysis completed for consultation {consultation_id}"
        
    except Consultation.DoesNotExist:
        return f"Consultation {consultation_id} not found"
    except Exception as e:
        consultation = Consultation.objects.get(id=consultation_id)
        consultation.status = 'failed'
        
        # 에러 메시지를 analysis_result에 저장 (사용자가 확인할 수 있도록)
        error_message = str(e)
        if "할당량 초과" in error_message or "quota" in error_message.lower() or "ResourceExhausted" in error_message:
            consultation.analysis_result = (
                "❌ **Gemini API 할당량 초과**\n\n"
                "무료 티어 할당량을 모두 사용했습니다.\n\n"
                "**해결 방법:**\n"
                "1. 잠시 후 다시 시도하세요 (보통 몇 분 후 재사용 가능)\n"
                "2. Google AI Studio에서 할당량 확인: https://ai.dev/usage?tab=rate-limit\n"
                "3. 유료 플랜으로 업그레이드 고려\n"
                "4. 더 작은 모델 사용 (gemini-2.0-flash-lite 등)\n\n"
                f"상세 에러: {error_message}"
            )
        else:
            consultation.analysis_result = f"❌ **분석 실패**\n\n에러: {error_message}"
        
        consultation.save()
        print(f"Consultation {consultation_id} 분석 실패: {error_message}")
        # Celery 태스크는 실패로 표시하되 예외를 다시 발생시키지 않음
        # (사용자가 UI에서 에러 메시지를 확인할 수 있도록)
        return f"Analysis failed for consultation {consultation_id}: {error_message}"



