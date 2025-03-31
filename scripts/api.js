class API {
    constructor() {
        this.model = 'gemini-2.0-flash';
        this.defaultPrompt = "Вы — опытный психолог, готовый помочь пользователю.";
        this.headers = {
            'Content-Type': 'application/json',
        };
        this.apiKey = 'AIzaSyCfWJ5Z60bLAJGzqurcGbGp8t9uImAEnV0';
        this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`;
    }

    validateMessages(messages) {
        if (!Array.isArray(messages)) {
            throw new Error('Messages должен быть массивом');
        }
        if (messages.length === 0) {
            throw new Error('Messages не может быть пустым');
        }
        for (const msg of messages) {
            if (!msg.role || !msg.content) {
                throw new Error('Каждое сообщение должно иметь role и content');
            }
            if (typeof msg.content !== 'string' || msg.content.trim().length === 0) {
                throw new Error('Content должен быть непустой строкой');
            }
            if (!['system', 'user', 'assistant'].includes(msg.role)) {
                throw new Error('Role должен быть system, user или assistant');
            }
        }
        return true;
    }

    async makeRequest(messages) {
        const requestBody = {
            contents: [{
                parts: [{ text: messages.join('\n') }]
            }]
        };

        try {
            this.validateMessages(messages);
            console.log('Отправка запроса:', JSON.stringify(requestBody, null, 2));

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(requestBody)
            });

            const responseText = await response.text();
            console.log('Получен ответ:', responseText);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${responseText}`);
            }

            const data = JSON.parse(responseText);
            return data;
        } catch (error) {
            console.error('Ошибка запроса:', error);
            throw error;
        }
    }

    async loadPrompt(psychId) {
        try {
            console.log(`Загрузка промпта для психолога ${psychId}...`);
            const promptPath = `prompts/${psychId}.txt`;
            console.log('Путь к файлу промпта:', promptPath);

            const response = await fetch(promptPath);
            if (!response.ok) {
                console.warn(`Промпт для ${psychId} не найден (статус ${response.status}), использую стандартный промпт`);
                return this.defaultPrompt;
            }

            const text = await response.text();
            if (!text || text.trim().length === 0) {
                console.warn(`Промпт для ${psychId} пуст, использую стандартный промпт`);
                return this.defaultPrompt;
            }

            console.log(`Промпт для ${psychId} успешно загружен (${text.length} символов)`);
            return text.trim();
        } catch (error) {
            console.error(`Ошибка загрузки промпта для ${psychId}:`, error);
            console.error('Stack trace:', error.stack);
            return this.defaultPrompt;
        }
    }

    async testConnection() {
        try {
            console.log('Тестирование подключения к серверу модели...');
            const messages = [
                {
                    role: "system",
                    content: "Test connection"
                },
                {
                    role: "user",
                    content: "Hello"
                }
            ];

            const data = await this.makeRequest(messages);
            return data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Ошибка подключения к серверу модели:', error);
            return false;
        }
    }

    async getAIResponse(selectedPsych, message) {
        try {
            console.log('Получение ответа для психолога:', selectedPsych);

            // Добавляем проверку на пустой message
            if (!message || typeof message !== 'string' || message.trim().length === 0) {
                throw new Error('Сообщение пользователя не может быть пустым');
            }

            const systemPrompt = await this.loadPrompt(selectedPsych);
            console.log('Загруженный системный промпт:', systemPrompt);

            // Валидация промпта
            if (!systemPrompt || systemPrompt.trim().length === 0) {
                throw new Error('Системный промпт не может быть пустым');
            }

            const messages = [
                {
                    role: "system",
                    content: systemPrompt.trim() // Добавляем trim
                },
                {
                    role: "user",
                    content: message.trim() // Добавляем trim
                }
            ];

            // Явная валидация структуры
            this.validateMessages(messages);

            const data = await this.makeRequest(messages);

            // Улучшенная проверка ответа
            if (!data || typeof data !== 'object') {
                throw new Error('Получен некорректный ответ от сервера');
            }

            if (!Array.isArray(data.choices) || data.choices.length === 0) {
                throw new Error('Сервер вернул пустой список вариантов ответа');
            }

            const firstChoice = data.choices[0];
            if (!firstChoice.message || typeof firstChoice.message.content !== 'string') {
                throw new Error('Некорректный формат ответа от сервера');
            }

            return data;
        } catch (error) {
            console.error('Ошибка при получении ответа от API:', error);

            // Формируем понятное пользователю сообщение об ошибке
            let userMessage = 'Произошла ошибка при получении ответа. ';

            if (error.message.includes('Failed to fetch')) {
                userMessage += 'Сервер модели недоступен. Убедитесь, что он запущен на localhost:1234';
            } else if (error.message.includes('messages')) {
                userMessage += 'Ошибка в формате сообщения. Попробуйте еще раз';
            } else {
                userMessage += error.message;
            }

            throw new Error(userMessage);
        }
    }
}

// Экспортируем API
window.APIClass = API;
// Создаем экземпляр API
window.api = new API();
