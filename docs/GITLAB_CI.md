# GitLab CI/CD для автоматической сборки Docker образов Superset

## Описание

Этот документ описывает настройку и использование GitLab CI/CD для автоматической сборки Docker образов Superset с поддержкой Mixed Chart 2.0.

## Требования

1. GitLab сервер с включенным Container Registry
2. GitLab Runner с поддержкой Docker (тег `docker`)
3. Ветка `feature/mixed-chart-v2` в репозитории

## Конфигурация

Файл `.gitlab-ci.yml` настроен для автоматической сборки Docker образов при пуше в ветку `feature/mixed-chart-v2`.

### Этапы сборки

1. **build-docker-lean** (автоматический)
   - Собирает production образ с таргетом `lean`
   - Запускается автоматически при каждом push в ветку
   - Создает три тега:
     - `feature-mixed-chart-v2` - основной тег ветки
     - `feature-mixed-chart-v2-latest` - последний собранный образ
     - `feature-mixed-chart-v2-<commit-sha>` - образ для конкретного коммита

2. **build-docker-dev** (ручной запуск)
   - Собирает development образ с таргетом `dev`
   - Запускается вручную через GitLab UI
   - Полезен для разработки и тестирования

## Использование в проекте "Промышленный проект"

### Шаг 1: Убедитесь, что образ собран

После push в ветку `feature/mixed-chart-v2` GitLab CI автоматически запустит сборку. Проверьте статус в GitLab:
- Перейдите: `https://gitlab.gdpgroup.ru/gdpgroup/superset_4.1.4_fork/-/pipelines`
- Убедитесь, что пайплайн успешно завершился

### Шаг 2: Используйте образ в Dockerfile

В Dockerfile проекта "Промышленный проект" замените:

```dockerfile
FROM apache/superset:4.1.4
```

на:

```dockerfile
FROM gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-mixed-chart-v2
```

Или используйте тег с конкретным коммитом для фиксированной версии:

```dockerfile
FROM gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-mixed-chart-v2-<commit-sha>
```

### Шаг 3: Аутентификация (если требуется)

Если Container Registry требует аутентификацию, выполните:

```bash
docker login gitlab.gdpgroup.ru:5050
# Введите username и password/token
```

Или используйте токен доступа:

```bash
docker login gitlab.gdpgroup.ru:5050 -u <username> -p <token>
```

## Доступные образы

После успешной сборки образы будут доступны в GitLab Container Registry:

- **Production образ (lean):**
  - `gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-mixed-chart-v2`
  - `gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-mixed-chart-v2-latest`
  - `gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-mixed-chart-v2-<commit-sha>`

- **Development образ (dev):**
  - `gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-mixed-chart-v2-dev`
  - `gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-mixed-chart-v2-dev-<commit-sha>`

## Просмотр образов в GitLab

Образы можно просмотреть в GitLab UI:
- Перейдите: `https://gitlab.gdpgroup.ru/gdpgroup/superset_4.1.4_fork/container_registry`

## Обновление образа

При каждом новом коммите в ветку `feature/mixed-chart-v2`:
1. GitLab CI автоматически запустит сборку
2. Новый образ будет собран и отправлен в Container Registry
3. Тег `feature-mixed-chart-v2-latest` будет обновлен на новый образ

Для использования последней версии в проекте используйте тег `feature-mixed-chart-v2-latest`.

## Ручной запуск сборки

Для ручного запуска сборки dev образа:
1. Перейдите в GitLab: `https://gitlab.gdpgroup.ru/gdpgroup/superset_4.1.4_fork/-/pipelines`
2. Нажмите "Run pipeline"
3. Выберите ветку `feature/mixed-chart-v2`
4. В разделе "Variables" можно настроить дополнительные параметры
5. После запуска пайплайна, job `build-docker-dev` будет доступен для ручного запуска

## Настройка GitLab Runner

Убедитесь, что GitLab Runner настроен с тегом `docker`:

```toml
[[runners]]
  name = "docker-runner"
  url = "https://gitlab.gdpgroup.ru/"
  token = "..."
  executor = "docker"
  [runners.docker]
    image = "docker:24-dind"
    privileged = true
  [runners.tags]
    tags = ["docker"]
```

## Устранение проблем

### Проблема: Пайплайн не запускается

**Решение:**
- Убедитесь, что файл `.gitlab-ci.yml` находится в корне репозитория
- Проверьте, что GitLab Runner активен и имеет тег `docker`
- Проверьте настройки CI/CD в проекте GitLab

### Проблема: Ошибка при сборке образа

**Решение:**
- Проверьте логи пайплайна в GitLab
- Убедитесь, что Dockerfile корректен
- Проверьте доступность всех зависимостей

### Проблема: Не удается загрузить образ из Container Registry

**Решение:**
- Проверьте права доступа к Container Registry
- Убедитесь, что выполнен `docker login`
- Проверьте правильность URL образа

## Дополнительная информация

- Документация GitLab CI/CD: https://docs.gitlab.com/ee/ci/
- Документация Container Registry: https://docs.gitlab.com/ee/user/packages/container_registry/
- Время сборки: обычно 30-60 минут для lean образа
- Размер образа: ~1-2 GB для lean образа

