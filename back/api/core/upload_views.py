import os
import uuid
from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils import timezone
from PIL import Image, ImageOps
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import error_response
from core.models import Photo, Place
from core.serializers import UploadPhotoSerializer

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
MAX_DIMENSION = 1600  # px


def resolve_extension(upload_name: str, content_type: str) -> str:
    _, ext = os.path.splitext(upload_name)
    ext = ext.lower()
    if ext in ALLOWED_EXTENSIONS:
        return ext
    if content_type == "image/jpeg":
        return ".jpg"
    if content_type == "image/png":
        return ".png"
    if content_type == "image/webp":
        return ".webp"
    return ext or ".jpg"


class UploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UploadPhotoSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="入力内容に誤りがあります",
                details=serializer.errors,
            )

        data = serializer.validated_data
        uploaded_file = data["file"]
        if uploaded_file.size > MAX_FILE_SIZE:
            return error_response(
                code="VALIDATION_ERROR",
                message="画像サイズが上限(5MB)を超えています",
                details={"max_size": MAX_FILE_SIZE},
            )

        content_type = uploaded_file.content_type or ""
        if content_type not in ALLOWED_CONTENT_TYPES:
            return error_response(
                code="VALIDATION_ERROR",
                message="対応していない画像形式です",
                details={"content_type": content_type},
            )

        place = None
        if data.get("place_id"):
            try:
                place = Place.objects.get(pk=data["place_id"])
            except Place.DoesNotExist:
                return error_response(
                    code="VALIDATION_ERROR",
                    message="指定された施設が存在しません",
                    details={"place_id": str(data["place_id"])}
                )

        purpose = data["purpose"]
        now = timezone.now()
        subdir = Path("reviews") if purpose == Photo.PURPOSE_REVIEW else Path("places")
        subdir = subdir / f"{now:%Y}" / f"{now:%m}"
        extension = resolve_extension(uploaded_file.name, content_type)
        filename = f"{uuid.uuid4().hex}{extension}"

        storage = FileSystemStorage(location=settings.MEDIA_ROOT / subdir, base_url=settings.MEDIA_URL + str(subdir) + "/")
        saved_name = storage.save(filename, uploaded_file)
        relative_path = str(subdir / saved_name).replace("\\", "/")
        absolute_path = Path(storage.path(saved_name))

        try:
            with Image.open(absolute_path) as img:
                img = ImageOps.exif_transpose(img)
                width, height = img.size
                if max(width, height) > MAX_DIMENSION:
                    img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
                    save_kwargs: dict[str, object] = {}
                    if img.format == "JPEG":
                        save_kwargs = {"quality": 85, "optimize": True}
                    img.save(absolute_path, format=img.format, **save_kwargs)
                    width, height = img.size
        except Exception:
            return error_response(
                code="VALIDATION_ERROR",
                message="画像の解析に失敗しました",
            )

        file_size = absolute_path.stat().st_size
        storage_path = f"{settings.MEDIA_URL.rstrip('/')}/{relative_path}"

        photo = Photo.objects.create(
            place=place,
            uploaded_by=request.user,
            purpose=purpose,
            storage_path=storage_path,
            mime_type=content_type,
            width=width,
            height=height,
            file_size=file_size,
        )

        public_url = storage_path

        return Response(
            {
                "photo": {
                    "id": str(photo.id),
                    "storage_path": photo.storage_path,
                    "public_url": public_url,
                    "width": width,
                    "height": height,
                    "mime_type": photo.mime_type,
                }
            },
            status=201,
        )
