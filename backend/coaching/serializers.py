from rest_framework import serializers
from .models import Consultation


class ConsultationSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Consultation
        fields = ['id', 'title', 'file', 'file_type', 'status', 'status_display', 
                  'original_content', 'analysis_result', 'supabase_file_url',
                  'created_at', 'updated_at', 'completed_at']
        read_only_fields = ['status', 'original_content', 'analysis_result', 
                          'supabase_file_url', 'created_at', 'updated_at', 'completed_at']


class ConsultationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Consultation
        fields = ['title', 'file', 'file_type']

