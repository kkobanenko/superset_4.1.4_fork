# Инструкция по пересборке Docker образа с плагином Pivot Table V2

## Обзор

Эта инструкция описывает процесс пересборки базового Docker образа в GitLab CI/CD с новым плагином `Pivot Table V2`.

## Предварительные требования

1. Все изменения должны быть закоммичены и запушены в ветку `feature/pivot-table-v2`
2. Плагин должен быть зарегистрирован в `MainPreset.js`
3. Плагин должен быть собран (`npm run plugins:build`)

## Шаги по пересборке образа

### 1. Проверка текущего состояния

Убедитесь, что вы находитесь в правильной ветке и все изменения закоммичены:

```bash
cd /home/kobanenkokn/Superset_4.1.4_fork
git branch --show-current  # Должно быть: feature/pivot-table-v2
git status                  # Проверьте незакоммиченные изменения
```

### 2. Коммит и пуш изменений

Если есть незакоммиченные изменения:

```bash
git add .
git commit -m "feat(pivot-table-v2): add Pivot Table V2 plugin with extended formatting settings"
git push origin feature/pivot-table-v2
```

### 3. Запуск пайплайна в GitLab CI/CD

После push в ветку `feature/pivot-table-v2` GitLab CI автоматически запустит пайплайн `build-docker-lean`.

**Вариант A: Автоматический запуск (рекомендуется)**
- Просто сделайте `git push` - пайплайн запустится автоматически
- Проверьте статус: https://gitlab.gdpgroup.ru/gdpgroup/superset_4.1.4_fork/-/pipelines

**Вариант B: Ручной запуск через GitLab UI**
1. Откройте: https://gitlab.gdpgroup.ru/gdpgroup/superset_4.1.4_fork/-/pipelines
2. Нажмите "Run pipeline"
3. Выберите ветку `feature/pivot-table-v2`
4. Нажмите "Run pipeline"

**Вариант C: Ручной запуск dev образа**
1. Откройте пайплайн в GitLab UI
2. Найдите джоб `build-docker-dev`
3. Нажмите кнопку "Play" для ручного запуска

### 4. Ожидание завершения сборки

- Сборка может занять **1-2 часа**
- Следите за прогрессом в GitLab CI/CD UI
- После успешной сборки образ будет доступен в GitLab Container Registry

### 5. Использование нового образа

После успешной сборки обновите `docker/Dockerfile-superset-dev`:

```dockerfile
FROM gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-pivot-table-v2-dev
```

Или для production:

```dockerfile
FROM gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-pivot-table-v2
```

### 6. Пересборка локального dev образа

После обновления базового образа пересоберите локальный dev образ:

```bash
cd /home/kobanenkokn/Superset_4.1.4_fork/docker
docker compose -f docker-compose.dev.yml build --no-cache superset_dev
docker compose -f docker-compose.dev.yml up -d
```

### 7. Проверка плагина

1. Откройте http://localhost:18088
2. Войдите: `admin` / `admin`
3. Создайте новый чарт
4. В списке визуализаций должна быть **"Pivot Table V2"**

## Теги образов

После сборки будут созданы следующие теги:

- `feature-pivot-table-v2` - основной тег ветки
- `feature-pivot-table-v2-latest` - последний собранный образ
- `feature-pivot-table-v2-<commit-sha>` - образ для конкретного коммита
- `feature-pivot-table-v2-dev` - dev образ (при ручном запуске)

## Устранение проблем

### Пайплайн не запускается автоматически

Проверьте:
- Правильность имени ветки: `feature/pivot-table-v2`
- Наличие файла `.gitlab-ci.yml` в корне репозитория
- Настройки GitLab CI/CD в проекте

### Ошибки сборки

Проверьте логи пайплайна в GitLab UI:
- Откройте пайплайн → выберите джоб → смотрите логи
- Частые проблемы:
  - Недостаточно памяти для сборки frontend
  - Ошибки компиляции TypeScript
  - Проблемы с зависимостями npm

### Плагин не отображается после пересборки

Убедитесь, что:
- Плагин зарегистрирован в `MainPreset.js`
- Плагин собран (`npm run plugins:build`)
- Изменения закоммичены и запушены
- Используется правильный тег образа

## Дополнительная информация

- Документация GitLab CI/CD: https://docs.gitlab.com/ee/ci/
- Container Registry: https://gitlab.gdpgroup.ru/gdpgroup/superset_4.1.4_fork/container_registry
- Pipelines: https://gitlab.gdpgroup.ru/gdpgroup/superset_4.1.4_fork/-/pipelines

