from django.contrib import admin
from django.urls import path
from core.views import (
    PingView,
    PlacesSearchView,
    PlaceDetailView,
    CategoriesListView,
    FeaturesListView,
    AgeBandsListView,
)
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/ping/', PingView.as_view(), name='ping'),
    # 施設検索（距離順・半径フィルタ・limit・cursor）
    path('api/places', PlacesSearchView.as_view(), name='places-search'),
    # 施設詳細
    path('api/places/<uuid:place_id>', PlaceDetailView.as_view(), name='place-detail'),
    # マスタ参照
    path('api/categories', CategoriesListView.as_view(), name='categories-list'),
    path('api/features', FeaturesListView.as_view(), name='features-list'),
    path('api/age-bands', AgeBandsListView.as_view(), name='age-bands-list'),
    # OpenAPI スキーマ（JSON）
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    # Swagger UI（/api/schema/ を参照）
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # Redoc UI（/api/schema/ を参照）
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
