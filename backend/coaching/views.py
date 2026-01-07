from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import StreamingHttpResponse
from django.utils import timezone
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .models import Consultation
from .serializers import ConsultationSerializer, ConsultationCreateSerializer
from .tasks import analyze_consultation


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
    @action(detail=True, methods=['get'])
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
        
        response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response
    
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
