from celery import shared_task
from django.utils import timezone
from django.conf import settings
from .models import Consultation
import google.generativeai as genai
import os
import mimetypes


@shared_task
def analyze_consultation(consultation_id):
    """상담 내용을 분석하는 Celery 태스크"""
    try:
        consultation = Consultation.objects.get(id=consultation_id)
        consultation.status = 'processing'
        consultation.save()
        
        # Gemini API 설정
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(settings.GEMINI_MODEL)
        
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
        
        # 파일 타입에 따라 처리
        if file_type == 'text':
            # 텍스트 파일: 내용 읽기
            with open(file_path, 'r', encoding='utf-8') as f:
                file_content = f.read()
            
            full_prompt = f"""{user_prompt}

상담 내용:
{file_content}"""
            
            response = model.generate_content(full_prompt)
            analysis_result = response.text
            
        elif file_type in ['audio', 'video']:
            # 오디오/비디오 파일: Gemini가 직접 처리 (multimodal)
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                if file_type == 'audio':
                    mime_type = 'audio/mpeg'
                elif file_type == 'video':
                    mime_type = 'video/mp4'
            
            # 파일 업로드 및 분석
            with open(file_path, 'rb') as f:
                file_data = f.read()
            
            # Gemini에 파일과 프롬프트 전달
            file_part = {
                "mime_type": mime_type,
                "data": file_data
            }
            
            response = model.generate_content([
                system_prompt,
                user_prompt,
                file_part
            ])
            analysis_result = response.text
            
        else:
            raise ValueError(f"지원하지 않는 파일 형식: {file_type}")
        
        # 결과 저장
        consultation.analysis_result = analysis_result
        consultation.status = 'completed'
        consultation.completed_at = timezone.now()
        consultation.save()
        
        return f"Analysis completed for consultation {consultation_id}"
        
    except Consultation.DoesNotExist:
        return f"Consultation {consultation_id} not found"
    except Exception as e:
        consultation = Consultation.objects.get(id=consultation_id)
        consultation.status = 'failed'
        consultation.save()
        raise e



