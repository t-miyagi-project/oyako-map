from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from core.models import AgeBand, UserProfile


User = get_user_model()


class AgeBandSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgeBand
        fields = ("id", "code", "label", "sort")


class UserProfileSerializer(serializers.ModelSerializer):
    child_age_band = AgeBandSerializer(read_only=True)
    child_age_band_id = serializers.PrimaryKeyRelatedField(
        source="child_age_band",
        queryset=AgeBand.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = UserProfile
        fields = (
            "nickname",
            "home_area",
            "child_age_band",
            "child_age_band_id",
        )


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer()

    class Meta:
        model = User
        fields = ("id", "email", "username", "is_active", "profile")


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    nickname = serializers.CharField(max_length=150, required=False, allow_blank=True)
    home_area = serializers.CharField(max_length=150, required=False, allow_blank=True)
    child_age_band_id = serializers.PrimaryKeyRelatedField(
        queryset=AgeBand.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("このメールアドレスは既に登録されています。")
        return value

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class ProfileUpdateSerializer(serializers.Serializer):
    nickname = serializers.CharField(max_length=150, required=False, allow_blank=True)
    home_area = serializers.CharField(max_length=150, required=False, allow_blank=True)
    child_age_band_id = serializers.PrimaryKeyRelatedField(
        queryset=AgeBand.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )
