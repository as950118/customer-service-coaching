from celery import shared_task
from django.utils import timezone
from django.conf import settings
from .models import Consultation
import openai
import os


@shared_task
def analyze_consultation(consultation_id):
    """상담 내용을 분석하는 Celery 태스크"""
    try:
        consultation = Consultation.objects.get(id=consultation_id)
        consultation.status = 'processing'
        consultation.save()
        
        # 파일 내용 읽기
        file_path = consultation.file.path
        file_content = _read_file_content(file_path, consultation.file_type)
        
        # OpenAI API를 사용한 분석
        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        
        prompt = f"""다음은 고객 상담 대화 내용입니다. 이 상담을 분석하여 개선이 필요한 사항들을 도출해주세요.

상담 내용:
{file_content}

다음 항목들을 중심으로 분석해주세요:
1. 고객 응대 태도
2. 문제 해결 능력
3. 커뮤니케이션 스킬
4. 개선이 필요한 구체적인 사항

분석 결과를 구조화된 형태로 제공해주세요."""

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "당신은 고객 상담 품질을 분석하는 전문가입니다."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
        )
        
        analysis_result = response.choices[0].message.content
        
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


def _read_file_content(file_path, file_type):
    """파일 타입에 따라 내용 읽기"""
    if file_type == 'text':
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    elif file_type in ['audio', 'video']:
        # 오디오/비디오 파일의 경우 전사가 필요하지만, 
        # 여기서는 간단히 파일명만 반환 (실제로는 Whisper API 등을 사용)
        return f"오디오/비디오 파일: {os.path.basename(file_path)}"
    else:
        return "지원하지 않는 파일 형식입니다."

