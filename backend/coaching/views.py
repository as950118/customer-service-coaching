from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.renderers import BaseRenderer
from django.http import StreamingHttpResponse, HttpResponse, FileResponse, HttpResponseRedirect
from django.utils import timezone
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
import os
import requests
from urllib.parse import urlparse
from .models import Consultation
from .serializers import ConsultationSerializer, ConsultationCreateSerializer
from .tasks import analyze_consultation


class SSERenderer(BaseRenderer):
    """Server-Sent Events 렌더러"""
    media_type = 'text/event-stream'
    format = 'sse'
    
    def render(self, data, accepted_media_type=None, renderer_context=None):
        # 이 메서드는 사용되지 않지만 DRF 요구사항을 충족하기 위해 필요
        return data


class ConsultationViewSet(viewsets.ModelViewSet):
    """
    상담 파일을 업로드하고 분석 결과를 조회하는 API
    
    - list: 상담 목록 조회
    - create: 상담 파일 업로드 및 분석 시작
    - retrieve: 상담 상세 조회
    - stream: SSE를 통한 실시간 분석 진행 상황 조회
    """
    queryset = Consultation.objects.all()
    serializer_class = ConsultationSerializer
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ConsultationCreateSerializer
        return ConsultationSerializer
    
    def finalize_response(self, request, response, *args, **kwargs):
        """SSE 스트림과 파일 다운로드의 경우 DRF 처리 흐름 우회"""
        if isinstance(response, (StreamingHttpResponse, FileResponse, HttpResponseRedirect)):
            return response
        return super().finalize_response(request, response, *args, **kwargs)
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        consultation = serializer.save()
        
        # Celery 태스크로 분석 시작
        analyze_consultation.delay(consultation.id)
        
        return Response(
            ConsultationSerializer(consultation).data,
            status=status.HTTP_201_CREATED
        )
    
    @swagger_auto_schema(
        method='get',
        operation_summary='SSE 스트림으로 분석 진행 상황 조회',
        operation_description='Server-Sent Events를 통해 상담 분석의 실시간 진행 상황을 받습니다.',
        responses={
            200: openapi.Response(
                description='SSE 스트림',
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'type': openapi.Schema(type=openapi.TYPE_STRING, description='이벤트 타입 (processing, completed, failed)'),
                        'consultation_id': openapi.Schema(type=openapi.TYPE_INTEGER),
                        'status': openapi.Schema(type=openapi.TYPE_STRING),
                        'analysis_result': openapi.Schema(type=openapi.TYPE_STRING, description='분석 결과 (완료 시)'),
                    }
                )
            )
        },
        tags=['상담']
    )
    @action(detail=True, methods=['get'], renderer_classes=[SSERenderer])
    def stream(self, request, pk=None):
        """SSE 스트림으로 분석 진행 상황 전송"""
        consultation = self.get_object()
        
        def event_stream():
            while True:
                consultation.refresh_from_db()
                
                # 상태에 따른 이벤트 전송
                if consultation.status == 'completed':
                    yield f"data: {self._format_event('completed', consultation)}\n\n"
                    break
                elif consultation.status == 'failed':
                    yield f"data: {self._format_event('failed', consultation)}\n\n"
                    break
                elif consultation.status == 'processing':
                    yield f"data: {self._format_event('processing', consultation)}\n\n"
                
                # 1초마다 체크
                import time
                time.sleep(1)
        
        # DRF의 응답 처리 흐름을 우회하여 직접 StreamingHttpResponse 반환
        response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        # Connection 헤더는 WSGI에서 hop-by-hop 헤더로 처리되므로 제거
        return response
    
    @swagger_auto_schema(
        method='get',
        operation_summary='원본 파일 다운로드',
        operation_description='업로드된 원본 파일을 다운로드합니다.',
        tags=['상담']
    )
    @action(detail=True, methods=['get'], renderer_classes=[SSERenderer])
    def download(self, request, pk=None):
        """원본 파일 다운로드"""
        consultation = self.get_object()
        
        # Supabase URL이 있으면 파일을 다운로드하여 반환
        if consultation.supabase_file_url:
            try:
                # Supabase URL에서 파일 다운로드
                file_response = requests.get(consultation.supabase_file_url, stream=True)
                file_response.raise_for_status()
                
                # 파일명 추출 (URL에서 또는 원본 파일명 사용)
                file_name = os.path.basename(consultation.file.name) if consultation.file else 'download'
                # URL에서 파일명 추출 시도
                parsed_url = urlparse(consultation.supabase_file_url)
                url_filename = os.path.basename(parsed_url.path)
                if url_filename and url_filename != '/':
                    file_name = url_filename
                
                # Content-Type 확인
                content_type = file_response.headers.get('Content-Type', 'application/octet-stream')
                
                # 파일을 다운로드로 제공
                response = HttpResponse(file_response.content, content_type=content_type)
                response['Content-Disposition'] = f'attachment; filename="{file_name}"'
                return response
            except requests.RequestException as e:
                # Supabase 다운로드 실패 시 로컬 파일로 폴백
                print(f"Supabase 파일 다운로드 실패: {e}")
                if consultation.file and os.path.exists(consultation.file.path):
                    file_path = consultation.file.path
                    file_name = os.path.basename(file_path)
                    
                    response = FileResponse(
                        open(file_path, 'rb'),
                        content_type='application/octet-stream'
                    )
                    response['Content-Disposition'] = f'attachment; filename="{file_name}"'
                    return response
                else:
                    return Response(
                        {'error': '파일을 찾을 수 없습니다.'},
                        status=status.HTTP_404_NOT_FOUND
                    )
        
        # 로컬 파일 다운로드
        if consultation.file and os.path.exists(consultation.file.path):
            file_path = consultation.file.path
            file_name = os.path.basename(file_path)
            
            response = FileResponse(
                open(file_path, 'rb'),
                content_type='application/octet-stream'
            )
            response['Content-Disposition'] = f'attachment; filename="{file_name}"'
            return response
        else:
            return Response(
                {'error': '파일을 찾을 수 없습니다.'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    def _format_event(self, event_type, consultation):
        """이벤트 데이터 포맷팅"""
        import json
        data = {
            'type': event_type,
            'consultation_id': consultation.id,
            'status': consultation.status,
            'analysis_result': consultation.analysis_result if consultation.analysis_result else None,
        }
        return json.dumps(data)
