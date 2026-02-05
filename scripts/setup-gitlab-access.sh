#!/bin/bash
#
# Скрипт для настройки доступа к GitLab серверу
# Использование: ./setup-gitlab-access.sh IP_АДРЕС
#

set -e

GITLAB_HOST="gitlab.gdpgroup.ru"
GITLAB_IP="${1}"

if [ -z "$GITLAB_IP" ]; then
    echo "❌ Ошибка: Не указан IP адрес GitLab сервера"
    echo ""
    echo "Использование: $0 IP_АДРЕС"
    echo ""
    echo "Пример: $0 192.168.1.100"
    echo ""
    echo "Чтобы найти IP адрес GitLab:"
    echo "  1. Откройте GitLab в браузере с вашей рабочей машины"
    echo "  2. Проверьте IP адрес в адресной строке или через ping"
    echo "  3. Или спросите у администратора сети"
    exit 1
fi

echo "Настройка доступа к GitLab..."
echo "  Хост: $GITLAB_HOST"
echo "  IP: $GITLAB_IP"
echo ""

# Проверяем, есть ли уже запись в /etc/hosts
if grep -q "$GITLAB_HOST" /etc/hosts 2>/dev/null; then
    echo "⚠️  Найдена существующая запись для $GITLAB_HOST в /etc/hosts:"
    grep "$GITLAB_HOST" /etc/hosts
    echo ""
    read -p "Заменить существующую запись? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Удаляем старую запись
        sudo sed -i "/$GITLAB_HOST/d" /etc/hosts
        echo "✅ Старая запись удалена"
    else
        echo "Отмена. Используется существующая запись."
        exit 0
    fi
fi

# Добавляем новую запись в /etc/hosts
echo "Добавление записи в /etc/hosts..."
echo "$GITLAB_IP $GITLAB_HOST" | sudo tee -a /etc/hosts

if [ $? -eq 0 ]; then
    echo "✅ Запись успешно добавлена в /etc/hosts"
    echo ""
    echo "Проверка доступности..."
    
    # Проверяем доступность через ping
    if ping -c 1 -W 2 "$GITLAB_IP" > /dev/null 2>&1; then
        echo "✅ Ping успешен"
    else
        echo "⚠️  Ping не прошел, но это может быть нормально (firewall)"
    fi
    
    # Проверяем доступность через curl
    if curl -I --connect-timeout 5 "https://$GITLAB_HOST" > /dev/null 2>&1; then
        echo "✅ HTTPS доступен"
    else
        echo "⚠️  HTTPS недоступен, проверьте настройки сети/VPN"
    fi
    
    echo ""
    echo "Теперь можно выполнить:"
    echo "  git push origin feature/pivot-table-v2"
else
    echo "❌ Ошибка при добавлении записи в /etc/hosts"
    exit 1
fi
