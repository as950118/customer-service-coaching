from django.contrib import admin
from .models import Consultation


@admin.register(Consultation)
class ConsultationAdmin(admin.ModelAdmin):
    list_display = ['title', 'file_type', 'status', 'created_at', 'completed_at']
    list_filter = ['status', 'file_type', 'created_at']
    search_fields = ['title']
    readonly_fields = ['created_at', 'updated_at', 'completed_at']
