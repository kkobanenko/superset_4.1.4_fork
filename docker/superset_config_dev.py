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

"""
Development configuration for Superset dev environment.
This file is mounted into the dev container at /app/pythonpath/superset_config.py
"""

import os

# Enable proxy fix for running behind reverse proxy
ENABLE_PROXY_FIX = True

# Development-specific settings
DEBUG = True
FLASK_ENV = "development"

# Feature flags for development/testing
# Add any feature flags you want to test here
# FEATURE_FLAGS = {
#     "ENABLE_TEMPLATE_PROCESSING": True,
# }

# Logging level for development
LOG_LEVEL = "DEBUG"

# Version shown in Settings -> About (overrides version_info.json / package.json)
VERSION_STRING = os.environ.get("SUPERSET_VERSION", "0.0.142")

# Explicitly set database URI to PostgreSQL (override any defaults)
# This ensures we use PostgreSQL instead of SQLite
# Always use PostgreSQL - override any SQLite defaults
SQLALCHEMY_DATABASE_URI = os.environ.get(
    "SQLALCHEMY_DATABASE_URI",
    "postgresql+psycopg2://superset_dev:superset_dev@postgres_dev:5432/superset_dev"
)

# Allow CORS for local development (if needed)
# ENABLE_CORS = True
# CORS_OPTIONS = {
#     "supports_credentials": True,
#     "allow_headers": ["*"],
#     "resources": ["*"],
#     "origins": ["*"],
# }

# Enable internationalization with Russian locale
LANGUAGES = {
    "en": {"flag": "us", "name": "English"},
    "ru": {"flag": "ru", "name": "Russian"},
}

