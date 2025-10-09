from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path
from core.auth_views import (
    SignupView,
    LoginView,
    RefreshView,
    LogoutView,
    MeView,
)
from core.review_views import ReviewCreateView
from core.upload_views import UploadView
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
    # 認証
    path('api/auth/signup', SignupView.as_view(), name='auth-signup'),
    path('api/auth/login', LoginView.as_view(), name='auth-login'),
    path('api/auth/refresh', RefreshView.as_view(), name='auth-refresh'),
    path('api/auth/logout', LogoutView.as_view(), name='auth-logout'),
    path('api/me', MeView.as_view(), name='me'),
    path('api/reviews', ReviewCreateView.as_view(), name='reviews-create'),
    path('api/uploads', UploadView.as_view(), name='photo-upload'),
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
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
