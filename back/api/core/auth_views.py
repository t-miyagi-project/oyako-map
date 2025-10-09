from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken

from core.exceptions import error_response
from core.models import UserProfile
from core.serializers import (
    LoginSerializer,
    ProfileUpdateSerializer,
    SignupSerializer,
)

User = get_user_model()


def _serialize_child_age_band(profile: UserProfile) -> dict | None:
    if not profile.child_age_band:
        return None
    band = profile.child_age_band
    return {
        "id": str(band.id),
        "code": band.code,
        "label": band.label,
        "sort": band.sort,
    }


def _serialize_user(user: User) -> dict:
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return {
        "id": str(user.id),
        "email": user.email,
        "role": "admin" if user.is_staff else "member",
        "nickname": profile.nickname,
        "home_area": profile.home_area,
        "child_age_band": _serialize_child_age_band(profile),
    }


def _token_response(user: User) -> Response:
    refresh = RefreshToken.for_user(user)
    data = {
        "user": _serialize_user(user),
        "access_token": str(refresh.access_token),
        "refresh_token": str(refresh),
    }
    return Response(data, status=status.HTTP_200_OK)


class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="入力内容に誤りがあります",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        data = serializer.validated_data
        with transaction.atomic():
            user = User.objects.create_user(
                username=data["email"],
                email=data["email"],
                password=data["password"],
            )
            nickname = data.get("nickname") or data["email"].split("@")[0]
            home_area = data.get("home_area") or None
            child_age_band = data.get("child_age_band_id")
            UserProfile.objects.create(
                user=user,
                nickname=nickname,
                home_area=home_area,
                child_age_band=child_age_band,
            )
        response = _token_response(user)
        response.status_code = status.HTTP_201_CREATED
        return response


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="入力内容に誤りがあります",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        data = serializer.validated_data
        user = authenticate(request, username=data["email"], password=data["password"])
        if not user:
            return error_response(
                code="UNAUTHORIZED",
                message="メールアドレスまたはパスワードが正しくありません",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
        return _token_response(user)


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get("refresh_token")
        if not refresh_token:
            return error_response(
                code="VALIDATION_ERROR",
                message="refresh_token is required",
                details={"field": "refresh_token"},
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            return error_response(
                code="UNAUTHORIZED",
                message="refresh token is invalid or expired",
                details={"detail": exc.args[0] if exc.args else str(exc)},
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
        data = serializer.validated_data
        response = {
            "access_token": data["access"],
        }
        if "refresh" in data:
            response["refresh_token"] = data["refresh"]
        return Response(response, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get("refresh_token")
        if not refresh_token:
            return error_response(
                code="VALIDATION_ERROR",
                message="refresh_token is required",
                details={"field": "refresh_token"},
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except (TokenError, InvalidToken) as exc:
            return error_response(
                code="UNAUTHORIZED",
                message="refresh token is invalid or expired",
                details={"detail": exc.args[0] if exc.args else str(exc)},
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"user": _serialize_user(request.user)}, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="入力内容に誤りがあります",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        data = serializer.validated_data
        if "nickname" in data:
            profile.nickname = data.get("nickname") or None
        if "home_area" in data:
            profile.home_area = data.get("home_area") or None
        if "child_age_band_id" in data:
            profile.child_age_band = data.get("child_age_band_id")
        profile.save()
        return Response({"user": _serialize_user(request.user)}, status=status.HTTP_200_OK)
