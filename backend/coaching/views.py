from rest_framework import viewsets, status, generics, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.renderers import BaseRenderer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.http import StreamingHttpResponse, HttpResponse, FileResponse, HttpResponseRedirect
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.db.models import Count, Avg, Q, F, Sum
from django.db.models.functions import TruncDate, TruncWeek, TruncMonth
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
import os
import requests
from urllib.parse import urlparse
from datetime import timedelta, datetime
from django.contrib.auth.models import User
from .models import Consultation
from .serializers import (
    ConsultationSerializer, 
    ConsultationCreateSerializer,
    UserRegistrationSerializer,
    UserSerializer
)
from .tasks import analyze_consultation


class SSERenderer(BaseRenderer):
    """Server-Sent Events 렌더러"""
    media_type = 'text/event-stream'
    format = 'sse'
    
    def render(self, data, accepted_media_type=None, renderer_context=None):
        # 이 메서드는 사용되지 않지만 DRF 요구사항을 충족하기 위해 필요
        return data


class UserRegistrationView(generics.CreateAPIView):
    """회원가입 API"""
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserRegistrationSerializer
    
    @swagger_auto_schema(
        operation_summary='회원가입',
        operation_description='새로운 사용자를 등록합니다.',
        tags=['인증'],
        responses={
            201: openapi.Response(
                description='회원가입 성공',
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'user': openapi.Schema(type=openapi.TYPE_OBJECT, description='사용자 정보'),
                        'tokens': openapi.Schema(
                            type=openapi.TYPE_OBJECT,
                            properties={
                                'refresh': openapi.Schema(type=openapi.TYPE_STRING),
                                'access': openapi.Schema(type=openapi.TYPE_STRING),
                            }
                        ),
                    }
                )
            )
        }
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # JWT 토큰 생성
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


@swagger_auto_schema(
    method='get',
    operation_summary='현재 사용자 정보 조회',
    operation_description='현재 로그인한 사용자의 정보를 조회합니다.',
    tags=['인증'],
    responses={
        200: openapi.Response(
            description='사용자 정보',
            schema=UserSerializer
        )
    }
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_current_user(request):
    """현재 로그인한 사용자 정보 조회"""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


class ConsultationViewSet(viewsets.ModelViewSet):
    """
    상담 파일을 업로드하고 분석 결과를 조회하는 API
    
    - list: 상담 목록 조회 (본인 것만)
    - create: 상담 파일 업로드 및 분석 시작
    - retrieve: 상담 상세 조회 (본인 것만)
    - stream: SSE를 통한 실시간 분석 진행 상황 조회
    """
    serializer_class = ConsultationSerializer
    
    def get_queryset(self):
        """현재 사용자의 상담만 조회 및 필터링"""
        if not self.request.user.is_authenticated:
            return Consultation.objects.none()
        
        queryset = Consultation.objects.filter(user=self.request.user)
        
        # 필터링 파라미터
        title = self.request.query_params.get('title', None)
        status = self.request.query_params.get('status', None)
        file_type = self.request.query_params.get('file_type', None)
        date_from = self.request.query_params.get('date_from', None)
        date_to = self.request.query_params.get('date_to', None)
        
        # 제목 검색 (부분 일치)
        if title:
            queryset = queryset.filter(title__icontains=title)
        
        # 상태 필터
        if status:
            queryset = queryset.filter(status=status)
        
        # 파일 타입 필터
        if file_type:
            queryset = queryset.filter(file_type=file_type)
        
        # 날짜 범위 필터
        if date_from:
            try:
                date_from_obj = parse_date(date_from)
                if date_from_obj:
                    queryset = queryset.filter(created_at__date__gte=date_from_obj)
            except (ValueError, TypeError):
                pass
        
        if date_to:
            try:
                date_to_obj = parse_date(date_to)
                if date_to_obj:
                    queryset = queryset.filter(created_at__date__lte=date_to_obj)
            except (ValueError, TypeError):
                pass
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ConsultationCreateSerializer
        return ConsultationSerializer
    
    def finalize_response(self, request, response, *args, **kwargs):
        """SSE 스트림과 파일 다운로드의 경우 DRF 처리 흐름 우회"""
        # 파일 다운로드 응답인 경우 Content-Disposition 헤더 확인
        if isinstance(response, (StreamingHttpResponse, FileResponse, HttpResponseRedirect, HttpResponse)):
            # HttpResponse인 경우 Content-Disposition 헤더가 있으면 파일 다운로드로 간주
            if isinstance(response, HttpResponse):
                content_disposition = response.get('Content-Disposition', '')
                if 'attachment' in content_disposition or 'filename' in content_disposition:
                    return response
                # 일반 HttpResponse는 DRF 처리 흐름을 거침
                return super().finalize_response(request, response, *args, **kwargs)
            return response
        return super().finalize_response(request, response, *args, **kwargs)
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # 현재 사용자를 자동으로 할당
        consultation = serializer.save(user=request.user)
        
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
        # DRF의 IsAuthenticated permission이 이미 인증을 확인함
        consultation = self.get_object()
        
        # 본인의 상담만 접근 가능하도록 확인
        if consultation.user != request.user:
            return Response(
                {'error': '권한이 없습니다.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
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
        # DRF의 IsAuthenticated permission이 이미 인증을 확인함
        consultation = self.get_object()
        
        # 본인의 상담만 접근 가능하도록 확인
        if consultation.user != request.user:
            return Response(
                {'error': '권한이 없습니다.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
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


class IsAdminUser(permissions.BasePermission):
    """관리자 권한 체크"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and (request.user.is_staff or request.user.is_superuser)


@swagger_auto_schema(
    method='get',
    operation_summary='KPI 지표 조회',
    operation_description='관리자용 KPI 지표를 조회합니다. 기간 파라미터를 통해 특정 기간의 지표를 조회할 수 있습니다.',
    tags=['관리자'],
    manual_parameters=[
        openapi.Parameter('period', openapi.IN_QUERY, description='기간 (daily, weekly, monthly, all)', type=openapi.TYPE_STRING),
        openapi.Parameter('date_from', openapi.IN_QUERY, description='시작 날짜 (YYYY-MM-DD)', type=openapi.TYPE_STRING),
        openapi.Parameter('date_to', openapi.IN_QUERY, description='종료 날짜 (YYYY-MM-DD)', type=openapi.TYPE_STRING),
    ],
    responses={
        200: openapi.Response(description='KPI 지표 데이터'),
        403: openapi.Response(description='권한 없음'),
    }
)
@api_view(['GET'])
@permission_classes([IsAdminUser])
def get_kpi_metrics(request):
    """KPI 지표 계산 및 반환"""
    # 기간 파라미터
    period = request.query_params.get('period', 'all')  # daily, weekly, monthly, all
    date_from = request.query_params.get('date_from', None)
    date_to = request.query_params.get('date_to', None)
    
    # 날짜 범위 설정
    now = timezone.now()
    if period == 'daily':
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = now
    elif period == 'weekly':
        start_date = now - timedelta(days=7)
        end_date = now
    elif period == 'monthly':
        start_date = now - timedelta(days=30)
        end_date = now
    else:  # all
        start_date = None
        end_date = None
    
    # 사용자 지정 날짜 범위가 있으면 우선 적용
    if date_from:
        try:
            start_date = timezone.make_aware(datetime.strptime(date_from, '%Y-%m-%d'))
        except ValueError:
            pass
    if date_to:
        try:
            end_date = timezone.make_aware(datetime.strptime(date_to, '%Y-%m-%d'))
            end_date = end_date.replace(hour=23, minute=59, second=59)
        except ValueError:
            pass
    
    # 기본 쿼리셋
    base_queryset = Consultation.objects.all()
    if start_date:
        base_queryset = base_queryset.filter(created_at__gte=start_date)
    if end_date:
        base_queryset = base_queryset.filter(created_at__lte=end_date)
    
    # 1. 사용자 활동 지표
    total_consultations = base_queryset.count()
    daily_consultations = Consultation.objects.filter(
        created_at__date=now.date()
    ).count() if not date_from and not date_to else None
    
    weekly_consultations = Consultation.objects.filter(
        created_at__gte=now - timedelta(days=7)
    ).count() if not date_from and not date_to else None
    
    monthly_consultations = Consultation.objects.filter(
        created_at__gte=now - timedelta(days=30)
    ).count() if not date_from and not date_to else None
    
    # 파일 타입별 분포
    file_type_distribution = base_queryset.values('file_type').annotate(
        count=Count('id')
    ).order_by('-count')
    
    file_type_percentages = {}
    if total_consultations > 0:
        for item in file_type_distribution:
            file_type_percentages[item['file_type']] = round(
                (item['count'] / total_consultations) * 100, 1
            )
    
    # 활성 사용자 수 (DAU, WAU)
    today = now.date()
    week_start = today - timedelta(days=7)
    
    dau = User.objects.filter(
        consultations__created_at__date=today
    ).distinct().count() if not date_from and not date_to else None
    
    wau = User.objects.filter(
        consultations__created_at__gte=week_start
    ).distinct().count() if not date_from and not date_to else None
    
    # 재방문율 계산 (이전에 업로드한 사용자가 다시 업로드하는 비율)
    if not date_from and not date_to:
        # 전체 사용자 중 이번 주에 업로드한 사용자
        users_with_previous_uploads = User.objects.filter(
            consultations__created_at__lt=week_start
        ).distinct()
        users_with_recent_uploads = User.objects.filter(
            consultations__created_at__gte=week_start
        ).distinct()
        returning_users = users_with_recent_uploads.filter(
            id__in=users_with_previous_uploads.values_list('id', flat=True)
        ).count()
        return_rate = round((returning_users / users_with_previous_uploads.count() * 100), 1) if users_with_previous_uploads.count() > 0 else 0
    else:
        return_rate = None
    
    # 2. 시스템 성능 지표
    completed_consultations = base_queryset.filter(status='completed')
    failed_consultations = base_queryset.filter(status='failed')
    
    success_rate = round((completed_consultations.count() / total_consultations * 100), 1) if total_consultations > 0 else 0
    failure_rate = round((failed_consultations.count() / total_consultations * 100), 1) if total_consultations > 0 else 0
    
    # 평균 처리 시간 계산
    processing_times = []
    file_type_processing_times = {}
    
    for consultation in completed_consultations.filter(completed_at__isnull=False):
        if consultation.completed_at and consultation.created_at:
            processing_time = (consultation.completed_at - consultation.created_at).total_seconds()
            processing_times.append(processing_time)
            
            # 파일 타입별 처리 시간
            if consultation.file_type not in file_type_processing_times:
                file_type_processing_times[consultation.file_type] = []
            file_type_processing_times[consultation.file_type].append(processing_time)
    
    avg_processing_time = round(sum(processing_times) / len(processing_times), 1) if processing_times else None
    
    # 파일 타입별 평균 처리 시간
    avg_processing_time_by_type = {}
    for file_type, times in file_type_processing_times.items():
        avg_processing_time_by_type[file_type] = round(sum(times) / len(times), 1)
    
    # 3. AI 분석 품질 지표
    # 분석 결과 길이
    analysis_lengths = [
        len(c.analysis_result) for c in completed_consultations 
        if c.analysis_result
    ]
    avg_analysis_length = round(sum(analysis_lengths) / len(analysis_lengths), 0) if analysis_lengths else None
    
    # 분석 항목 커버리지 (간단한 키워드 기반 체크)
    analysis_keywords = ['태도', '문제해결', '커뮤니케이션', '개선', '제안', '피드백']
    coverage_count = 0
    for consultation in completed_consultations.filter(analysis_result__isnull=False):
        analysis_text = consultation.analysis_result.lower()
        found_keywords = sum(1 for keyword in analysis_keywords if keyword in analysis_text)
        if found_keywords >= 2:  # 최소 2개 이상의 키워드가 있으면 커버리지 있음
            coverage_count += 1
    
    coverage_rate = round((coverage_count / completed_consultations.count() * 100), 1) if completed_consultations.count() > 0 else 0
    
    # 4. 기술적 지표
    # 데이터베이스 크기 (SQLite인 경우)
    db_size = None
    try:
        from django.conf import settings
        if 'sqlite' in settings.DATABASES['default']['ENGINE']:
            db_path = settings.DATABASES['default']['NAME']
            if os.path.exists(db_path):
                db_size = os.path.getsize(db_path) / (1024 * 1024)  # MB 단위
                db_size = round(db_size, 2)
    except Exception:
        pass
    
    # Supabase 업로드 성공률
    supabase_uploaded = base_queryset.filter(supabase_file_url__isnull=False).count()
    supabase_success_rate = round((supabase_uploaded / total_consultations * 100), 1) if total_consultations > 0 else 0
    
    # 응답 데이터 구성
    response_data = {
        'period': period,
        'date_range': {
            'from': start_date.isoformat() if start_date else None,
            'to': end_date.isoformat() if end_date else None,
        },
        'user_engagement': {
            'total_consultations': total_consultations,
            'daily_consultations': daily_consultations,
            'weekly_consultations': weekly_consultations,
            'monthly_consultations': monthly_consultations,
            'file_type_distribution': file_type_percentages,
            'file_type_counts': {item['file_type']: item['count'] for item in file_type_distribution},
            'dau': dau,
            'wau': wau,
            'return_rate': return_rate,
        },
        'system_performance': {
            'total_consultations': total_consultations,
            'completed_count': completed_consultations.count(),
            'failed_count': failed_consultations.count(),
            'success_rate': success_rate,
            'failure_rate': failure_rate,
            'avg_processing_time_seconds': avg_processing_time,
            'avg_processing_time_by_type': avg_processing_time_by_type,
        },
        'ai_analysis_quality': {
            'avg_analysis_length': avg_analysis_length,
            'coverage_rate': coverage_rate,
            'completed_analyses': completed_consultations.count(),
        },
        'technical_metrics': {
            'db_size_mb': db_size,
            'supabase_success_rate': supabase_success_rate,
            'total_files': total_consultations,
        },
        'targets': {
            'daily_consultations': 10,
            'weekly_consultations': 50,
            'monthly_consultations': 200,
            'success_rate': 95,
            'failure_rate': 5,
            'avg_processing_time_text': 30,
            'avg_processing_time_audio': 120,
            'avg_processing_time_video': 300,
            'coverage_rate': 80,
        }
    }
    
    return Response(response_data)
