from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)
from .views import (
    ConsultationViewSet,
    UserRegistrationView,
    get_current_user,
    get_kpi_metrics,
)

router = DefaultRouter()
router.register(r'consultations', ConsultationViewSet, basename='consultation')

urlpatterns = [
    path('', include(router.urls)),
    
    # 인증 관련 URL
    path('auth/register/', UserRegistrationView.as_view(), name='register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('auth/me/', get_current_user, name='current_user'),
    
    # 관리자 KPI
    path('admin/kpi/', get_kpi_metrics, name='kpi_metrics'),
]

