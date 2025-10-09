import uuid

from django.conf import settings
from django.db import migrations, models


def seed_review_axes(apps, schema_editor):
    ReviewAxis = apps.get_model("core", "ReviewAxis")
    data = [
        ("cleanliness", "清潔さ", 10),
        ("safety", "安全", 20),
        ("noise", "騒音", 30),
        ("staff", "スタッフ対応", 40),
        ("crowd", "混雑", 50),
    ]
    for code, label, sort in data:
        ReviewAxis.objects.update_or_create(
            code=code,
            defaults={"label": label, "sort": sort},
        )


def unseed_review_axes(apps, schema_editor):
    ReviewAxis = apps.get_model("core", "ReviewAxis")
    ReviewAxis.objects.filter(code__in=["cleanliness", "safety", "noise", "staff", "crowd"]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0005_create_user_profile"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.CreateModel(
                    name="Place",
                    fields=[
                        ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                    ],
                    options={
                        "db_table": "places",
                        "managed": False,
                    },
                ),
            ],
        ),
        migrations.CreateModel(
            name="ReviewAxis",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("code", models.CharField(max_length=100, unique=True)),
                ("label", models.CharField(max_length=100)),
                ("sort", models.IntegerField(default=100)),
            ],
            options={
                "db_table": "review_axes",
            },
        ),
        migrations.CreateModel(
            name="Review",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("overall", models.PositiveSmallIntegerField()),
                ("stay_minutes", models.PositiveIntegerField(blank=True, null=True)),
                ("revisit_intent", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("text", models.TextField()),
                ("status", models.CharField(default="public", max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("age_band", models.ForeignKey(blank=True, db_column="age_band_id", null=True, on_delete=models.deletion.SET_NULL, to="core.ageband")),
                ("place", models.ForeignKey(db_column="place_id", on_delete=models.deletion.CASCADE, to="core.place")),
                ("user", models.ForeignKey(db_column="user_id", on_delete=models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "reviews",
            },
        ),
        migrations.CreateModel(
            name="ReviewScore",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("score", models.PositiveSmallIntegerField()),
                ("axis", models.ForeignKey(db_column="axis_id", on_delete=models.deletion.CASCADE, to="core.reviewaxis")),
                ("review", models.ForeignKey(db_column="review_id", on_delete=models.deletion.CASCADE, to="core.review")),
            ],
            options={
                "db_table": "review_scores",
                "unique_together": {("review", "axis")},
            },
        ),
        migrations.AddIndex(
            model_name="review",
            index=models.Index(fields=["place", "created_at"], name="idx_reviews_place_created"),
        ),
        migrations.RunPython(seed_review_axes, unseed_review_axes),
    ]
