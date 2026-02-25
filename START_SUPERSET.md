# Инструкция по запуску Superset на localhost:18088

## Вариант 1: Использовать образ из GitLab CI/CD (рекомендуется)

### Шаг 1: Дождитесь завершения пайплайна

Проверьте статус пайплайна:
https://gitlab.gdpgroup.ru/gdpgroup/superset_4.1.4_fork/-/pipelines

Дождитесь успешного завершения джоба `build-docker-dev` (может занять 1-2 часа).

### Шаг 2: Обновите Dockerfile-superset-dev

Убедитесь, что в `docker/Dockerfile-superset-dev` указан правильный образ:
```dockerfile
FROM gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-pivot-table-v2-dev
```

### Шаг 3: Запустите контейнеры

```bash
cd /home/kobanenkokn/Superset_4.1.4_fork/docker

# Соберите dev образ (с ClickHouse и MSSQL драйверами)
docker compose -f docker-compose.dev.yml build --pull superset_dev

# Запустите все сервисы
docker compose -f docker-compose.dev.yml up -d

# Проверьте статус
docker compose -f docker-compose.dev.yml ps
```

### Шаг 4: Инициализируйте базу данных (если первый запуск)

```bash
cd /home/kobanenkokn/Superset_4.1.4_fork/docker

# Обновите схему БД
docker compose -f docker-compose.dev.yml exec superset_dev superset db upgrade

# Инициализируйте Superset (создаст admin пользователя)
docker compose -f docker-compose.dev.yml exec superset_dev superset init
```

**Учетные данные по умолчанию:**
- Username: `admin`
- Password: `admin`

### Шаг 5: Откройте Superset

Откройте в браузере: **http://localhost:18088**

---

## Вариант 2: Локальная сборка (если образ еще не готов)

Если пайплайн еще не завершился, можно собрать локально:

### Шаг 1: Соберите базовый образ локально

```bash
cd /home/kobanenkokn/Superset_4.1.4_fork

# Соберите dev образ (это займет много времени)
docker build \
  --target dev \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg LOAD_EXAMPLES_DUCKDB=false \
  --build-arg INCLUDE_CHROMIUM=false \
  --tag gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-pivot-table-v2-dev \
  -f Dockerfile .
```

### Шаг 2: Используйте локальный образ

Временно измените `docker/Dockerfile-superset-dev`:
```dockerfile
# Временно используем локальный образ
FROM gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-pivot-table-v2-dev
```

Затем выполните шаги 3-5 из Варианта 1.

---

## Полезные команды

### Просмотр логов
```bash
cd /home/kobanenkokn/Superset_4.1.4_fork/docker

# Все сервисы
docker compose -f docker-compose.dev.yml logs -f

# Только Superset
docker compose -f docker-compose.dev.yml logs -f superset_dev
```

### Остановка контейнеров
```bash
cd /home/kobanenkokn/Superset_4.1.4_fork/docker
docker compose -f docker-compose.dev.yml down
```

### Перезапуск после изменений
```bash
cd /home/kobanenkokn/Superset_4.1.4_fork/docker

# Остановить
docker compose -f docker-compose.dev.yml down

# Пересобрать
docker compose -f docker-compose.dev.yml build superset_dev

# Запустить
docker compose -f docker-compose.dev.yml up -d
```

### Сброс пароля admin
```bash
cd /home/kobanenkokn/Superset_4.1.4_fork/docker

docker compose -f docker-compose.dev.yml exec superset_dev \
  python -c "
from superset import app
from superset.extensions import security_manager
with app.app_context():
    user = security_manager.find_user(username='admin')
    if user:
        user.password = security_manager.generate_password_hash('admin')
        security_manager.update_user(user)
        print('Password reset successfully')
    else:
        print('User admin not found')
  "
```

---

## Проверка работы плагина Pivot Table V2

После запуска Superset:

1. Войдите как `admin` / `admin`
2. Создайте новый Chart
3. В списке типов визуализации должен быть **"Pivot Table V2"**
4. Выберите его и проверьте настройки форматирования

---

## Устранение проблем

### Плагин не отображается
- Убедитесь, что образ собран с новым плагином
- Проверьте логи: `docker compose -f docker-compose.dev.yml logs superset_dev | grep -i plugin`
- Пересоберите образ

### Ошибка подключения к базе данных
- Проверьте, что PostgreSQL запущен: `docker compose -f docker-compose.dev.yml ps postgres_dev`
- Проверьте логи PostgreSQL: `docker compose -f docker-compose.dev.yml logs postgres_dev`

### Порт 18088 занят
- Проверьте, что порт свободен: `netstat -tuln | grep 18088`
- Остановите другие контейнеры, использующие этот порт

