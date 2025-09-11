import uuid
from typing import Any

from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_default_exception_handler
from rest_framework.exceptions import (
    ValidationError,
    NotAuthenticated,
    PermissionDenied,
    NotFound,
    MethodNotAllowed,
    ParseError,
    UnsupportedMediaType,
    Throttled,
    APIException,
)


def _new_trace_id() -> str:
    """トレースIDを生成する（例: req_ab12cd34ef56）。
    - クライアント問い合わせ時の追跡に利用する。
    """
    return f"req_{uuid.uuid4().hex[:12]}"


def error_response(code: str, message: str, details: dict | list | None = None, status_code: int = 400) -> Response:
    """共通のエラーレスポンスを生成する。
    - code: エラー分類（VALIDATION_ERROR / UNAUTHORIZED / FORBIDDEN / NOT_FOUND / RATE_LIMITED / CONFLICT / SERVER_ERROR など）
    - message: 人が読める説明
    - details: フィールドごとの詳細や補足
    - status_code: HTTPステータスコード
    """
    payload = {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
            "trace_id": _new_trace_id(),
        }
    }
    return Response(payload, status=status_code)


def custom_exception_handler(exc: Exception, context: dict) -> Response:
    """DRFの例外を受け取り、共通フォーマットに変換するハンドラ。
    - DRFの既定ハンドラでステータス/分類を判断し、{ error: { code, message, details, trace_id } } に正規化する。
    - 想定外の例外は 500 SERVER_ERROR として扱う。
    """
    resp = drf_default_exception_handler(exc, context)

    if resp is not None:
        status_code = resp.status_code
        code = "SERVER_ERROR"
        message = "internal server error"
        details: Any = None

        # 代表的なDRF例外ごとにコード/メッセージをマッピング
        if isinstance(exc, ValidationError):
            code = "VALIDATION_ERROR"
            message = "validation error"
            details = resp.data
        elif isinstance(exc, NotAuthenticated):
            code = "UNAUTHORIZED"
            message = "authentication required"
        elif isinstance(exc, PermissionDenied):
            code = "FORBIDDEN"
            message = "forbidden"
        elif isinstance(exc, NotFound):
            code = "NOT_FOUND"
            message = "not found"
        elif isinstance(exc, MethodNotAllowed):
            code = "METHOD_NOT_ALLOWED"
            message = "method not allowed"
        elif isinstance(exc, Throttled):
            code = "RATE_LIMITED"
            message = "too many requests"
            details = {"wait": getattr(exc, "wait", None)}
        elif isinstance(exc, ParseError):
            code = "BAD_REQUEST"
            message = "request parse error"
        elif isinstance(exc, UnsupportedMediaType):
            code = "UNSUPPORTED_MEDIA_TYPE"
            message = "unsupported media type"
        elif status_code == 409:
            code = "CONFLICT"
            message = "conflict"
        elif isinstance(exc, APIException):
            # 汎用API例外：DRFが整形したメッセージを尊重しつつコードは一般化
            code = "API_ERROR"
            message = str(getattr(exc, "detail", "api error")) or "api error"
            details = resp.data if isinstance(resp.data, (dict, list)) else None
        else:
            # ステータスコードからのフォールバック分類
            if status_code >= 500:
                code = "SERVER_ERROR"
                message = "internal server error"
            elif status_code == 400:
                code = "BAD_REQUEST"
                message = "bad request"
            elif status_code == 401:
                code = "UNAUTHORIZED"
                message = "authentication required"
            elif status_code == 403:
                code = "FORBIDDEN"
                message = "forbidden"
            elif status_code == 404:
                code = "NOT_FOUND"
                message = "not found"
            else:
                code = "API_ERROR"
                message = "api error"
                details = resp.data

        # 共通ペイロードに置き換えて返却
        resp.data = {
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
                "trace_id": _new_trace_id(),
            }
        }
        return resp

    # DRFのハンドラで処理できなかった例外（想定外）
    return error_response(code="SERVER_ERROR", message="internal server error", status_code=500)

