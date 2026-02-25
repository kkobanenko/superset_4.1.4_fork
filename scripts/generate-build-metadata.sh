#!/bin/bash
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# Скрипт для генерации метаданных сборки Docker образа
# Используется в GitLab CI/CD пайплайне для создания артефактов

set -e

# Параметры
BUILD_TYPE="${1:-production}"  # production или dev
OUTPUT_DIR="${2:-build-artifacts}"

# Создание директории для артефактов
mkdir -p "${OUTPUT_DIR}"

# Генерация JSON с метаданными
cat > "${OUTPUT_DIR}/build-info.json" <<EOF
{
  "build_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "commit_sha": "${CI_COMMIT_SHA:-unknown}",
  "commit_short_sha": "${CI_COMMIT_SHORT_SHA:-unknown}",
  "branch": "${CI_COMMIT_BRANCH:-unknown}",
  "branch_tag": "${BRANCH_TAG:-unknown}",
  "pipeline_id": "${CI_PIPELINE_ID:-unknown}",
  "job_id": "${CI_JOB_ID:-unknown}",
  "build_type": "${BUILD_TYPE}",
  "images": {
    "branch": "${IMAGE_TAG_BRANCH:-unknown}",
    "latest": "${IMAGE_TAG_LATEST:-unknown}",
    "commit": "${IMAGE_TAG_COMMIT:-unknown}"
  },
  "build_config": {
    "target": "${BUILD_TARGET:-unknown}",
    "platform": "${BUILD_PLATFORM:-unknown}",
    "build_translations": "${BUILD_TRANSLATIONS:-false}",
    "load_examples_duckdb": "${LOAD_EXAMPLES_DUCKDB:-false}",
    "include_chromium": "${INCLUDE_CHROMIUM:-false}"
  },
  "registry": {
    "url": "${CI_REGISTRY:-unknown}",
    "image": "${CI_REGISTRY_IMAGE:-unknown}"
  }
}
EOF

# Генерация YAML манифеста для развертывания
cat > "${OUTPUT_DIR}/deployment-manifest.yaml" <<EOF
# Deployment Manifest for Superset
# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Commit: ${CI_COMMIT_SHORT_SHA:-unknown}
# Branch: ${CI_COMMIT_BRANCH:-unknown}

version: 1.0
build_info:
  commit_sha: ${CI_COMMIT_SHA:-unknown}
  commit_short_sha: ${CI_COMMIT_SHORT_SHA:-unknown}
  branch: ${CI_COMMIT_BRANCH:-unknown}
  build_date: $(date -u +%Y-%m-%dT%H:%M:%SZ)
  pipeline_id: ${CI_PIPELINE_ID:-unknown}
  build_type: ${BUILD_TYPE}

images:
  production:
    image: ${IMAGE_TAG_BRANCH:-unknown}
    platform: ${BUILD_PLATFORM:-linux/amd64}
  latest:
    image: ${IMAGE_TAG_LATEST:-unknown}
    platform: ${BUILD_PLATFORM:-linux/amd64}
  commit:
    image: ${IMAGE_TAG_COMMIT:-unknown}
    platform: ${BUILD_PLATFORM:-linux/amd64}

usage:
  dockerfile: |
    FROM ${IMAGE_TAG_BRANCH:-unknown}
  docker_compose: |
    services:
      superset:
        image: ${IMAGE_TAG_BRANCH:-unknown}
        # Add your configuration here
EOF

# Генерация файла переменных окружения
cat > "${OUTPUT_DIR}/build-env.env" <<EOF
IMAGE_TAG_BRANCH=${IMAGE_TAG_BRANCH:-unknown}
IMAGE_TAG_LATEST=${IMAGE_TAG_LATEST:-unknown}
IMAGE_TAG_COMMIT=${IMAGE_TAG_COMMIT:-unknown}
BRANCH_TAG=${BRANCH_TAG:-unknown}
BUILD_TARGET=${BUILD_TARGET:-unknown}
BUILD_PLATFORM=${BUILD_PLATFORM:-unknown}
BUILD_TYPE=${BUILD_TYPE}
EOF

echo "✅ Build metadata generated successfully in ${OUTPUT_DIR}/"
echo "Files created:"
echo "  - build-info.json"
echo "  - deployment-manifest.yaml"
echo "  - build-env.env"
