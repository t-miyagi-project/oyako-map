from django.contrib import admin
from django.urls import path
from core.views import PingView, PlacesSearchView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/ping/', PingView.as_view(), name='ping'),
    # 施設検索（距離順・半径フィルタ・limit・cursor）
    path('api/places', PlacesSearchView.as_view(), name='places-search'),
]
