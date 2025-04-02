# План действий по проверке и отправке кода psycho-chat на GitHub

## 1. Анализ

*   **Проект:** `psycho-chat` - веб-приложение для чата с AI-психологами через Google Gemini API (HTML, CSS, JavaScript).
*   **Git:** Локальный репозиторий связан с GitHub (`https://github.com/olyyarm/psycho-chat.git`).

## 2. Обнаруженные проблемы

*   **Критическая проблема безопасности:** API-ключ находится в `psycho-chat/config.json`, и этот файл **не игнорируется** Git (`.gitignore`). **Риск утечки ключа при `git push`!**
*   **Качество кода:** В `psycho-chat/scripts/app.js` и `psycho-chat/scripts/api.js` присутствует отладочный код (`debugger;`, избыточные `console.log`, TODO), который нужно убрать перед публикацией.

## 3. План Решения

```mermaid
graph TD
    A[Начало] --> B{Проверка .gitignore};
    B -- | config.json отсутствует | --> C[Добавить config.json в .gitignore];
    C --> D{Проверка app.js};
    D -- | Найдены debugger; | --> E[Удалить debugger; из app.js];
    E --> F{Проверка app.js/api.js};
    D -- | debugger; отсутствуют | --> F;
    F -- | Найдены избыточные console.log/TODO | --> G[Очистить console.log/TODO в app.js/api.js];
    G --> H{Подготовка к Git Push};
    F -- | Код чистый | --> H;
    H --> I[git add .];
    I --> J[git commit -m "Clean up code and secure API key"];
    J --> K[git push origin main];
    K --> L[Завершение];
```

*   **Шаг 1: Обеспечить безопасность API ключа (Немедленно!)**
    *   Добавить строку `config.json` в файл `psycho-chat/.gitignore`.
*   **Шаг 2: Очистить JavaScript код**
    *   Удалить `debugger;` из `psycho-chat/scripts/app.js`.
    *   Просмотреть и удалить/доработать закомментированные участки и TODO в `psycho-chat/scripts/app.js`.
    *   Уменьшить количество `console.log` в `psycho-chat/scripts/app.js` и `psycho-chat/scripts/api.js`.
*   **Шаг 3: Отправить изменения на GitHub**
    *   Выполнить команды `git add`, `git commit` и `git push` для сохранения и отправки безопасного и очищенного кода.

## 4. Следующий шаг

*   Переключиться в режим "Code" для внесения изменений в файлы (`.gitignore`, `app.js`, `api.js`).