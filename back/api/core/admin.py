from django.contrib import admin
from core.models import AgeBand, Category, Feature, UserProfile, Photo


@admin.register(AgeBand)
class AgeBandAdmin(admin.ModelAdmin):
    list_display = ("label", "code", "sort")
    ordering = ("sort", "code")


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("label", "code", "sort")
    ordering = ("sort", "code")


@admin.register(Feature)
class FeatureAdmin(admin.ModelAdmin):
    list_display = ("label", "code", "category")
    search_fields = ("label", "code")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "nickname", "home_area", "child_age_band")
    search_fields = ("user__email", "nickname", "home_area")


@admin.register(Photo)
class PhotoAdmin(admin.ModelAdmin):
    list_display = ("id", "purpose", "uploaded_by", "place", "review", "created_at")
    list_filter = ("purpose",)
    search_fields = ("id", "uploaded_by__email")
