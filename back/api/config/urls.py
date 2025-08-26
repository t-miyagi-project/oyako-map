from django.contrib import admin
from django.urls import path
from core.views import PingView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/ping/', PingView.as_view(), name='ping'),
]
