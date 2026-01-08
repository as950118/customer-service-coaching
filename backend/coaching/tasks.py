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
import subprocess
import tempfile
import json
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
        
        # JSON 응답을 강제하기 위한 generation_config 설정
        generation_config = {
            "response_mime_type": "application/json",
            "temperature": 0.3,  # 일관성을 위해 낮은 temperature 사용
        }
        model = genai.GenerativeModel(model_name, generation_config=generation_config)
        
        file_path = consultation.file.path
        file_type = consultation.file_type
        
        # 프롬프트 구성
        system_prompt = "당신은 고객 상담 품질을 분석하는 전문가입니다. 항상 지정된 JSON 형식으로만 응답해야 합니다."
        user_prompt = """다음 상담 내용을 분석하여 개선이 필요한 사항들을 도출해주세요.

다음 항목들을 중심으로 분석해주세요:
1. 고객 응대 태도
2. 문제 해결 능력
3. 커뮤니케이션 스킬
4. 개선이 필요한 구체적인 사항

**중요: 반드시 아래 JSON 형식으로만 응답해주세요. 다른 텍스트나 설명은 포함하지 마세요.**

{
  "summary": "상담 전반에 대한 요약 (2-3문장)",
  "customer_service_attitude": {
    "score": 1-10 점수,
    "strengths": ["강점1", "강점2"],
    "weaknesses": ["개선점1", "개선점2"],
    "details": "상세 설명"
  },
  "problem_solving": {
    "score": 1-10 점수,
    "strengths": ["강점1", "강점2"],
    "weaknesses": ["개선점1", "개선점2"],
    "details": "상세 설명"
  },
  "communication_skills": {
    "score": 1-10 점수,
    "strengths": ["강점1", "강점2"],
    "weaknesses": ["개선점1", "개선점2"],
    "details": "상세 설명"
  },
  "improvement_recommendations": [
    {
      "category": "카테고리명",
      "issue": "문제점 설명",
      "recommendation": "개선 방안",
      "priority": "high/medium/low"
    }
  ],
  "overall_score": 1-10 점수,
  "overall_feedback": "종합 피드백 (3-5문장)"
}"""
        
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
            # 오디오/비디오 파일: 로컬에서 STT로 전사 후 텍스트만 LLM에 전송
            print(f"로컬 STT 시작: {file_path}")
            
            # 비디오 파일인 경우 오디오 추출
            audio_path = file_path
            temp_audio_file = None
            temp_audio_path = None
            
            if file_type == 'video':
                # ffmpeg를 사용하여 비디오에서 오디오 추출
                print("비디오에서 오디오 추출 중...")
                temp_audio_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
                temp_audio_path = temp_audio_file.name
                temp_audio_file.close()
                
                try:
                    # ffmpeg로 오디오 추출 (mp3 형식으로, Whisper가 잘 읽을 수 있도록)
                    result = subprocess.run(
                        ['ffmpeg', '-i', file_path, '-vn', '-acodec', 'libmp3lame', '-ab', '192k', '-ar', '44100', '-ac', '2', '-y', temp_audio_path],
                        check=True,
                        capture_output=True,
                        text=True
                    )
                    if not os.path.exists(temp_audio_path) or os.path.getsize(temp_audio_path) == 0:
                        raise Exception("오디오 파일 추출 실패: 파일이 생성되지 않았거나 비어있습니다.")
                    audio_path = temp_audio_path
                    print(f"오디오 추출 완료: {audio_path} ({os.path.getsize(audio_path)} bytes)")
                except subprocess.CalledProcessError as e:
                    error_msg = e.stderr.decode('utf-8', errors='ignore') if e.stderr else str(e)
                    raise Exception(f"비디오에서 오디오 추출 실패: {error_msg}")
                except FileNotFoundError:
                    raise Exception("ffmpeg가 설치되지 않았습니다. 비디오 처리를 위해 ffmpeg를 설치해주세요.")
            
            # Whisper를 사용하여 로컬에서 STT 수행
            try:
                import whisper
                print("Whisper 모델 로딩 중...")
                # base 모델 사용 (더 빠르고 가벼움, 필요시 medium, large로 변경 가능)
                whisper_model = whisper.load_model("base")
                print(f"오디오 전사 중: {audio_path}")
                
                # 파일 존재 및 크기 확인
                if not os.path.exists(audio_path):
                    raise Exception(f"오디오 파일이 존재하지 않습니다: {audio_path}")
                if os.path.getsize(audio_path) == 0:
                    raise Exception(f"오디오 파일이 비어있습니다: {audio_path}")
                
                result = whisper_model.transcribe(audio_path, language="ko")
                original_content = result["text"].strip()
                
                if not original_content:
                    raise Exception("전사 결과가 비어있습니다. 오디오에 음성이 없거나 인식할 수 없습니다.")
                
                print(f"전사 완료: {len(original_content)}자")
            except ImportError:
                raise Exception("openai-whisper가 설치되지 않았습니다. 'pip install openai-whisper'를 실행해주세요.")
            except Exception as e:
                raise Exception(f"STT 전사 실패: {str(e)}")
            finally:
                # 임시 오디오 파일 정리
                if temp_audio_path and os.path.exists(temp_audio_path):
                    try:
                        os.unlink(temp_audio_path)
                        print(f"임시 파일 삭제: {temp_audio_path}")
                    except Exception as e:
                        print(f"임시 파일 삭제 실패: {e}")
            
            # 전사된 텍스트로 분석 수행
            full_prompt = f"""{user_prompt}

상담 내용 (전사본):
{original_content}"""
            
            analysis_result = call_gemini_with_retry(full_prompt)
            
        else:
            raise ValueError(f"지원하지 않는 파일 형식: {file_type}")
        
        # JSON 응답 파싱 및 검증
        try:
            # JSON 파싱 시도 (응답에 마크다운 코드 블록이 있을 수 있으므로 처리)
            json_text = analysis_result.strip()
            # 마크다운 코드 블록 제거 (```json ... ``` 형식)
            if json_text.startswith('```'):
                lines = json_text.split('\n')
                json_text = '\n'.join(lines[1:-1]) if lines[-1].strip() == '```' else '\n'.join(lines[1:])
            
            parsed_result = json.loads(json_text)
            
            # 필수 필드 검증
            required_fields = ['summary', 'customer_service_attitude', 'problem_solving', 
                             'communication_skills', 'improvement_recommendations', 
                             'overall_score', 'overall_feedback']
            missing_fields = [field for field in required_fields if field not in parsed_result]
            
            if missing_fields:
                print(f"경고: JSON 응답에 필수 필드가 누락되었습니다: {missing_fields}")
                # 누락된 필드가 있어도 계속 진행 (부분적 결과라도 저장)
            
            # 파싱된 JSON을 다시 문자열로 변환하여 저장 (일관된 포맷)
            analysis_result = json.dumps(parsed_result, ensure_ascii=False, indent=2)
            print("JSON 파싱 성공")
            
        except json.JSONDecodeError as e:
            print(f"경고: JSON 파싱 실패. 원본 응답을 그대로 저장합니다. 에러: {e}")
            print(f"원본 응답 (처음 500자): {analysis_result[:500]}")
            # JSON 파싱 실패 시 원본 응답을 그대로 저장
            # (사용자가 확인할 수 있도록)
        
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



