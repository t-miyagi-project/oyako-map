FROM python:3.13-slim

# (任意) OSパッケージ
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    build-essential curl ca-certificates git sudo \
  && rm -rf /var/lib/apt/lists/*

# 文字化け回避
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TZ=Asia/Tokyo

# VS Code 用ユーザー（あなたの UID/GID を build args で注入）
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=1000
RUN groupadd --gid ${USER_GID} ${USERNAME} \
  && useradd -s /bin/bash --uid ${USER_UID} --gid ${USER_GID} -m ${USERNAME} \
  && echo "${USERNAME} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/90-${USERNAME} \
  && chmod 0440 /etc/sudoers.d/90-${USERNAME}

WORKDIR /app

# 依存インストール
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# プロジェクトソース（最初は空でも可。後でマウントするので最小でOK）
COPY . /app

# デフォルトコマンド（開発用）
CMD ["bash", "-lc", "python manage.py runserver 0.0.0.0:8000"]