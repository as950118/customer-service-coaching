from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User


class Consultation(models.Model):
    """상담 세션 모델"""
    STATUS_CHOICES = [
        ('pending', '대기중'),
        ('processing', '처리중'),
        ('completed', '완료'),
        ('failed', '실패'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='consultations', verbose_name='사용자', null=True, blank=True)
    title = models.CharField(max_length=200, verbose_name='제목')
    file = models.FileField(upload_to='consultations/', verbose_name='파일')
    file_type = models.CharField(max_length=50, verbose_name='파일 타입')  # text, audio, video
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='상태')
    original_content = models.TextField(blank=True, null=True, verbose_name='원본 내용')
    analysis_result = models.TextField(blank=True, null=True, verbose_name='분석 결과')
    supabase_file_url = models.URLField(blank=True, null=True, verbose_name='Supabase 파일 URL')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정일')
    completed_at = models.DateTimeField(blank=True, null=True, verbose_name='완료일')
    
    class Meta:
        verbose_name = '상담'
        verbose_name_plural = '상담들'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.title} - {self.get_status_display()}"
