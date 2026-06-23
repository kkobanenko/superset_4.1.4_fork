<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Superset Fork

Форк Apache Superset `4.1.4` с доработками `Pivot Table V2` и изолированным локальным dev-окружением на `http://localhost:18088`.

Этот README — краткая шпаргалка: что пересобрать, перезапустить и проверить после каждого типа изменений. Подробности — в связанных документах.

## Ключевые документы

| Документ | Когда нужен |
| --- | --- |
| [`docker/README.dev.md`](docker/README.dev.md) | Локальный dev-стек, логи, сброс, troubleshooting |
| [`START_SUPERSET.md`](START_SUPERSET.md) | Пошаговый запуск на порту `18088` |
| [`REBUILD_DOCKER_IMAGE.md`](REBUILD_DOCKER_IMAGE.md) | Пересборка образа через CI/CD |
| [`PRD.md`](PRD.md) | Контекст и статус доработок форка |
| [`superset-frontend/plugins/plugin-chart-pivot-table-v2/`](superset-frontend/plugins/plugin-chart-pivot-table-v2/) | Исходники плагина |

## Изменение -> что сделать

| Что изменили | Действия перед тестовым деплоем или передачей |
| --- | --- |
| Frontend или плагин в `superset-frontend/` | `npm run plugins:build` и `npm run build`, затем перезапуск или пересборка dev-контейнера. Проверить UI на `http://localhost:18088`. |
| Backend Python в `superset/` | Пересобрать или перезапустить dev-контейнер. Если схема БД не менялась — может хватить restart. Проверить старт приложения и вход. |
| Docker-файлы или dev-конфиг (`docker-compose.dev.yml`, `superset_config_dev.py`) | `docker compose -f docker/docker-compose.dev.yml up -d --build`. Проверить статус контейнера и env. |
| Схема БД или миграции | Пересобрать или перезапустить контейнер, затем `docker compose -f docker/docker-compose.dev.yml exec superset_dev superset db upgrade`. Проверить старт после upgrade. |
| Только документация | Деплой не нужен. |

## Типовые процедуры

### Пересборка frontend-ассетов

```bash
cd superset-frontend
npm run plugins:build
npm run build
```

### Пересборка или перезапуск локального dev-стека

```bash
docker compose -f docker/docker-compose.dev.yml up -d --build
```

Если пересборка образа не нужна — только перезапуск приложения:

```bash
docker compose -f docker/docker-compose.dev.yml restart superset_dev
```

### Инициализация или обновление метаданных БД

```bash
docker compose -f docker/docker-compose.dev.yml exec superset_dev superset db upgrade
docker compose -f docker/docker-compose.dev.yml exec superset_dev superset init
```

`superset init` — при первом запуске или когда локальное окружение нужно переинициализировать.

### Проверка версии или env

```bash
docker compose -f docker/docker-compose.dev.yml exec superset_dev printenv SUPERSET_VERSION
docker compose -f docker/docker-compose.dev.yml ps
```

Если изменение уходит в сборку форка — синхронизируйте версию с текущей практикой проекта перед передачей сборки.

## Чеклист проверки

- Открыть `http://localhost:18088`
- Войти: `admin` / `admin`
- Если менялся UI — проверить нужный экран или чарт в браузере
- Если менялись конфиг или сборка — убедиться, что контейнер работает и `SUPERSET_VERSION` ожидаемый
- Если менялись миграции — убедиться, что приложение стартует после `superset db upgrade`

Страницы для отладки в этом форке:

- Explore: `http://localhost:18088/explore/?form_data_key=v56qw5jg_sY&dashboard_page_id=n1VbmsWxakwba3O0a9bhN&slice_id=166`
- Dashboard: `http://localhost:18088/superset/dashboard/16/`

## Локальный dev-стек

- Superset: `18088`
- Postgres: `15432`
- Redis: `16379`

Запуск:

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

Логи:

```bash
docker compose -f docker/docker-compose.dev.yml logs -f superset_dev
```

## Заметки по форку

- Основная зона доработок — `Pivot Table V2`.
- Изменения frontend часто требуют и пересборки ассетов, и перезапуска приложения — иначе браузер может показать старые файлы.
- Процедуры prod-деплоя здесь не описаны. Для prod смотрите CI/CD и документацию по образам проекта.

## Upstream Superset

Общая документация Apache Superset:

- [Официальная документация](https://superset.apache.org)
- [Установка и конфигурация](https://superset.apache.org/docs/installation/architecture/)
- [Руководство для контрибьюторов](https://github.com/apache/superset/blob/master/CONTRIBUTING.md)
- [REST API](https://superset.apache.org/docs/rest-api)
