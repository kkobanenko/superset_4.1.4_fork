#!/usr/bin/env bash
# Запуск тестового dev-окружения. Обязательно из корня репозитория, чтобы volume с статикой был верным.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export COMPOSE_PROJECT_NAME=superset
exec docker-compose -f docker/docker-compose.dev.yml "$@"
