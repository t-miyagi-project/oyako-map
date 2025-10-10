import uuid

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0006_create_reviews"),
    ]

    operations = [
        migrations.CreateModel(
            name="Photo",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("purpose", models.CharField(choices=[("review_photo", "Review Photo"), ("place_photo", "Place Photo")], max_length=32)),
                ("storage_path", models.TextField()),
                ("mime_type", models.CharField(blank=True, max_length=64, null=True)),
                ("width", models.IntegerField(blank=True, null=True)),
                ("height", models.IntegerField(blank=True, null=True)),
                ("file_size", models.BigIntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("place", models.ForeignKey(blank=True, db_column="place_id", null=True, on_delete=models.deletion.CASCADE, related_name="photos", to="core.place")),
                ("review", models.ForeignKey(blank=True, db_column="review_id", null=True, on_delete=models.deletion.CASCADE, related_name="photos", to="core.review")),
                ("uploaded_by", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="uploaded_photos", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "photos",
            },
        ),
        migrations.AddIndex(
            model_name="photo",
            index=models.Index(fields=["place", "created_at"], name="idx_photos_place"),
        ),
        migrations.AddIndex(
            model_name="photo",
            index=models.Index(fields=["review", "created_at"], name="idx_photos_review"),
        ),
    ]
