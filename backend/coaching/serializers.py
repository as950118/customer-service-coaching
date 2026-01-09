from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from .models import Consultation


class UserRegistrationSerializer(serializers.ModelSerializer):
    """회원가입 시리얼라이저"""
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True, label='비밀번호 확인')
    
    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2', 'first_name', 'last_name')
        extra_kwargs = {
            'email': {'required': True},
        }
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "비밀번호가 일치하지 않습니다."})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    """사용자 정보 시리얼라이저"""
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser')


class ConsultationSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Consultation
        fields = ['id', 'user', 'title', 'file', 'file_type', 'status', 'status_display', 
                  'original_content', 'analysis_result', 'supabase_file_url',
                  'created_at', 'updated_at', 'completed_at']
        read_only_fields = ['user', 'status', 'original_content', 'analysis_result', 
                          'supabase_file_url', 'created_at', 'updated_at', 'completed_at']


class ConsultationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Consultation
        fields = ['title', 'file', 'file_type']

