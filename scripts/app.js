class PsychoChat {
    constructor() {
        this.selectedPsychologists = [];
        this.chatMode = 'single';
        this.highlightEnabled = false;
        this.isProcessing = false;
        this.appConfig = null;
        this.elements = null; // To store DOM elements
        this.history = {}; // { psychId: [{ role: 'user'/'assistant', content: '...' }] }
    }

    init() {
        this.elements = this.getElements();
        if (!this.elements) {
            console.error('Не удалось найти ключевые DOM элементы. Инициализация прервана.');
            return;
        }

        window.api.loadConfig()
            .then(config => {
                if (!config) throw new Error('loadConfig вернул невалидный конфиг');
                this.appConfig = config;

                const urlParams = new URLSearchParams(window.location.search);
                const initialPsychId = urlParams.get('psychologist');
                let psychToSelect = null;

                if (initialPsychId && this.appConfig.psychologists.some(p => p.id === initialPsychId && p.active)) {
                     console.log(`Найден активный психолог в URL: ${initialPsychId}`);
                     psychToSelect = initialPsychId;
                } else {
                    const firstActivePsych = this.appConfig.psychologists.find(p => p.active);
                    if (firstActivePsych) {
                         console.log('Психолог из URL не найден/не активен, выбираем первого активного:', firstActivePsych.id);
                         psychToSelect = firstActivePsych.id;
                    } else {
                         throw new Error('В конфигурации нет активных психологов.');
                    }
                }

                if (psychToSelect) {
                    this.selectPsychologist(psychToSelect); // Вызываем здесь, КОГДА КОНФИГ ТОЧНО ЕСТЬ
                } else {
                     throw new Error('Не удалось определить психолога для выбора.');
                }

                this.initializeEventHandlers();
                this.updateChatUI();
                console.log('[INIT] Инициализация успешно завершена.');

            })
            .catch(error => {
                 console.error('[INIT] Ошибка на этапе инициализации (после загрузки DOM):', error);
                 this.displayError(`Ошибка инициализации: ${error.message}`);
            });
    }

    getElements() {
        const elements = {
            psychologistsPanel: document.querySelector('.psychologists-panel'),
            currentPsychologistsContainer: document.querySelector('.current-psychologists'),
            addPsychologistBtn: document.querySelector('.add-psychologist-btn'),
            psychologistsList: document.querySelector('.psychologists-list'),
            singleChatMode: document.querySelector('.single-chat-mode'),
            dualChatMode: document.querySelector('.dual-chat-mode'),
            chatMessagesSingle: document.querySelector('.single-chat-mode .chat-messages'),
            chatColumns: document.querySelector('.dual-chat-mode .chat-columns'), // Container for columns
            highlightToggle: document.querySelector('#highlightTerms'),
            chatInputWrapper: document.querySelector('.chat-input-wrapper'),
            userInput: document.querySelector('.chat-input textarea'),
            sendButton: document.querySelector('.send-button'),
            backButton: document.querySelector('.back-button')
        };

        // Проверяем наличие всех элементов
        for (const key in elements) {
            if (!elements[key]) {
                console.error(`DOM элемент не найден: ${key}`);
                return null;
            }
        }
        // Добавим получение колонок чата для dual-mode
        elements.chatColumnsElements = elements.dualChatMode.querySelectorAll('.chat-column');
        if (elements.chatColumnsElements.length !== 2) {
             console.warn('Ожидалось 2 колонки чата в dual-mode, найдено:', elements.chatColumnsElements.length);
        }

        return elements;
    }

    selectPsychologist(psychId) {
        if (!this.appConfig || !this.appConfig.psychologists) {
            console.error('Конфигурация психологов не загружена.');
            this.displayError('Ошибка: Конфигурация психологов не загружена.');
            return;
        }

        const psychologistData = this.appConfig.psychologists.find(p => p.id === psychId);

        if (psychologistData) {
            console.log(`Выбор психолога: ${psychId}`);
            // Проверяем, не выбран ли уже этот психолог
            if (this.selectedPsychologists.some(p => p.id === psychId)) {
                console.log(`Психолог ${psychId} уже выбран.`);
                return; // Ничего не делаем, если уже выбран
            }

            // Управляем количеством выбранных психологов
            if (this.chatMode === 'single') {
                this.selectedPsychologists = [psychologistData];
            } else { // dual mode
                if (this.selectedPsychologists.length < 2) {
                    this.selectedPsychologists.push(psychologistData);
                } else {
                    // Пока просто заменяем второго
                    console.log(`Замена второго психолога ${this.selectedPsychologists[1].id} на ${psychId}`);
                    this.selectedPsychologists[1] = psychologistData;
                }
            }

            // Инициализация истории для нового психолога, если ее нет
            if (!this.history[psychId]) {
                this.history[psychId] = [];
                console.log(`Инициализирована история для ${psychId}`);
            }
            this.updatePsychologistDisplay();
            this.updateChatUI();
            this.initializePsychologistsList();

            // Очистка поля ввода и сообщений при смене психолога (опционально)
            if (this.elements.userInput) this.elements.userInput.value = '';
            if (this.elements.sendButton) this.elements.sendButton.disabled = true;

        } else {
            console.error(`Психолог с ID ${psychId} не найден в конфигурации.`);
            this.displayError(`Ошибка: Психолог с ID ${psychId} не найден.`);
        }
    }

    addSecondPsychologist() {
        if (this.chatMode === 'single') {
            this.chatMode = 'dual';
            console.log('Переключение в режим двойного чата.');
            this.elements.addPsychologistBtn.textContent = 'Выберите второго психолога';
            this.elements.addPsychologistBtn.disabled = true; // Блокируем, пока не выберут
            this.elements.psychologistsList.classList.remove('hidden');
            this.updateChatUI();
            this.updatePsychologistDisplay(); // Обновит отображение первого
            this.initializePsychologistsList(); // Показать доступных для выбора
        }
    }

    removeSecondPsychologist(event, psychIdToRemove) {
        event.stopPropagation(); // Предотвращаем всплытие на родительские элементы
        console.log(`Удаление второго психолога: ${psychIdToRemove}`);

        this.selectedPsychologists = this.selectedPsychologists.filter(p => p.id !== psychIdToRemove);
        delete this.history[psychIdToRemove]; // Удаляем историю
        this.chatMode = 'single';

        this.updatePsychologistDisplay();
        this.updateChatUI();
        this.initializePsychologistsList(); // Обновляем список доступных
        this.elements.addPsychologistBtn.textContent = 'Добавить второго психолога';
        this.elements.addPsychologistBtn.disabled = false;
    }


    updatePsychologistDisplay() {
        if (!this.elements || !this.elements.currentPsychologistsContainer) return;

        const container = this.elements.currentPsychologistsContainer;
        container.innerHTML = ''; // Очищаем контейнер

        this.selectedPsychologists.forEach((psych, index) => {
            const div = document.createElement('div');
            div.classList.add('psychologist-display'); // Общий класс для стилей

            const img = document.createElement('img');
            img.src = psych.image || 'assets/images/placeholder.png'; // Placeholder if no image
            img.alt = `Фото ${psych.name}`;
            img.classList.add('psychologist-avatar');

            const infoDiv = document.createElement('div');
            infoDiv.classList.add('psychologist-info');

            const nameH1 = document.createElement('h1');
            nameH1.classList.add('psychologist-name');
            nameH1.textContent = psych.name;

            const titleP = document.createElement('p');
            titleP.classList.add('psychologist-title');
            titleP.textContent = psych.title;

            infoDiv.appendChild(nameH1);
            infoDiv.appendChild(titleP);

            div.appendChild(img);
            div.appendChild(infoDiv);

            // Добавляем кнопку удаления для второго психолога в режиме dual
            if (this.chatMode === 'dual' && index === 1) {
                const removeBtn = document.createElement('button');
                removeBtn.classList.add('remove-second-btn');
                removeBtn.innerHTML = '×'; // Крестик
                removeBtn.title = `Удалить ${psych.name} из чата`;
                removeBtn.onclick = (event) => this.removeSecondPsychologist(event, psych.id);
                div.appendChild(removeBtn);
                div.style.position = 'relative'; // Для позиционирования кнопки
            }

            container.appendChild(div);
        });

        // Управляем кнопкой добавления
        if (this.chatMode === 'single' && this.selectedPsychologists.length === 1) {
            this.elements.addPsychologistBtn.classList.remove('hidden');
            this.elements.addPsychologistBtn.disabled = false;
            this.elements.addPsychologistBtn.textContent = 'Добавить второго психолога';
        } else if (this.chatMode === 'dual' && this.selectedPsychologists.length === 1) {
             // Ждем выбора второго
             this.elements.addPsychologistBtn.classList.remove('hidden');
             this.elements.addPsychologistBtn.disabled = true;
             this.elements.addPsychologistBtn.textContent = 'Выберите второго психолога...';
        } else {
            this.elements.addPsychologistBtn.classList.add('hidden');
        }
    }

    initializePsychologistsList() {
        if (!this.elements || !this.elements.psychologistsList || !this.appConfig || !this.appConfig.psychologists) return;

        const list = this.elements.psychologistsList;
        list.innerHTML = ''; // Очищаем

        const availablePsychologists = this.appConfig.psychologists.filter(p =>
            p.active && !this.selectedPsychologists.some(selected => selected.id === p.id)
        );

        if (availablePsychologists.length === 0) {
             list.innerHTML = '<p>Нет доступных психологов для добавления.</p>';
             this.elements.addPsychologistBtn.disabled = true;
             this.elements.addPsychologistBtn.textContent = 'Нет доступных психологов';
             return;
        }

        availablePsychologists.forEach(psych => {
            const button = document.createElement('button'); // Используем кнопку для лучшей доступности
            button.classList.add('psychologist-list-item');
            button.dataset.id = psych.id;

            const img = document.createElement('img');
            img.src = psych.image || 'assets/images/placeholder.png';
            img.alt = ''; // Alt не нужен для декоративных иконок в списке
            img.classList.add('psychologist-list-avatar');

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('psychologist-list-name');
            nameSpan.textContent = psych.name;

            button.appendChild(img);
            button.appendChild(nameSpan);
            list.appendChild(button);
        });
    }

    updateChatUI() {
        if (!this.elements) return;
        try {
            if (this.chatMode === 'single') {
                this.elements.singleChatMode.classList.remove('hidden');
                this.elements.dualChatMode.classList.add('hidden');
            } else { // dual
                this.elements.singleChatMode.classList.add('hidden');
                this.elements.dualChatMode.classList.remove('hidden');

                // Обновляем заголовки колонок
                 if (this.elements.chatColumnsElements && this.elements.chatColumnsElements.length === 2 && this.selectedPsychologists.length > 0) {
                    this.selectedPsychologists.forEach((psych, index) => {
                        if (index < 2) {
                             const column = this.elements.chatColumnsElements[index];
                             if (!column) {
                                 console.error(`[UPDATE_UI] Колонка ${index} не найдена!`);
                                 return;
                             }
                            const header = column.querySelector('.psychologist-header');
                            if (header) {
                                 header.innerHTML = ''; // Очищаем
                                 const img = document.createElement('img');
                                 img.src = psych.image || 'assets/images/placeholder.png';
                                 img.alt = `Фото ${psych.name || 'психолога'}`;
                                 header.appendChild(img);

                                 const infoDiv = document.createElement('div');
                                 const nameH3 = document.createElement('h3');
                                 nameH3.textContent = psych.name || 'Неизвестный психолог';
                                 const titleP = document.createElement('p');
                                 titleP.textContent = psych.title || 'Нет описания';
                                 infoDiv.appendChild(nameH3);
                                 infoDiv.appendChild(titleP);
                                 header.appendChild(infoDiv);
                            } else {
                                 console.warn(`[UPDATE_UI] Элемент .psychologist-header не найден в колонке ${index}`);
                            }
                        }
                    });
                    // Если выбран только один, вторую колонку можно скрыть или показать placeholder
                     if (this.selectedPsychologists.length === 1 && this.elements.chatColumnsElements[1]) {
                         const header = this.elements.chatColumnsElements[1].querySelector('.psychologist-header');
                         if (header) {
                              header.innerHTML = '<p>Выберите второго психолога...</p>';
                         }
                     }
                } else {
                     console.warn('[UPDATE_UI] Условия для обновления колонок dual mode не выполнены:', {
                          colCount: this.elements.chatColumnsElements?.length,
                          psychCount: this.selectedPsychologists.length
                     });
                }
            }
        } catch (uiError) {
             console.error('[UPDATE_UI] Ошибка при обновлении UI:', uiError);
             this.displayError(`Ошибка UI: ${uiError.message}`);
        }

        // Скролл вниз при обновлении UI
        try {
             this.scrollToBottom();
        } catch (scrollError) {
             console.error('[UPDATE_UI] Ошибка при скролле:', scrollError);
             this.displayError(`Ошибка скролла: ${scrollError.message}`);
        }
    }

    displayMessage(sender, text, psychologistId = null) {
        if (!this.elements || !text) return;

        const messageElement = document.createElement('div');
        messageElement.classList.add('message');

        let targetMessagesContainer = null;

        if (this.chatMode === 'single') {
            targetMessagesContainer = this.elements.chatMessagesSingle;
            messageElement.classList.add(sender === 'user' ? 'user-message' : 'psychologist-message');
        } else { // dual
             let targetColumnIndex = -1;
             if (sender === 'user') {
                 // Сообщение пользователя отображается в обеих колонках
                 if (this.elements.chatColumnsElements.length === 2) {
                     const msgCol1 = this.elements.chatColumnsElements[0].querySelector('.chat-messages-column');
                     const msgCol2 = this.elements.chatColumnsElements[1].querySelector('.chat-messages-column');
                     if (msgCol1) this.appendAndScroll(msgCol1, this.createMessageElement(sender, text));
                     if (msgCol2) this.appendAndScroll(msgCol2, this.createMessageElement(sender, text));
                 }
                 targetMessagesContainer = null; // Обработали выше
             } else if (psychologistId) {
                 targetColumnIndex = this.selectedPsychologists.findIndex(p => p.id === psychologistId);
                 if (targetColumnIndex !== -1 && this.elements.chatColumnsElements[targetColumnIndex]) {
                     targetMessagesContainer = this.elements.chatColumnsElements[targetColumnIndex].querySelector('.chat-messages-column');
                     messageElement.classList.add('psychologist-message');
                 } else {
                      console.warn(`Не найдена колонка для психолога ${psychologistId}`);
                      targetMessagesContainer = this.elements.chatMessagesSingle; // Фоллбэк на сингл?
                 }
             }
        }

        // Если сообщение не было обработано для dual-mode user
        if (targetMessagesContainer) {
            messageElement.textContent = text; // Простой текст пока
            this.appendAndScroll(targetMessagesContainer, messageElement);
        }

        // --- Сохранение в историю ---
         const role = (sender === 'user') ? 'user' : 'assistant';
         const targetHistoryId = (sender === 'psychologist' && psychologistId) ? psychologistId :
                               (this.chatMode === 'single' && this.selectedPsychologists[0]) ? this.selectedPsychologists[0].id : null;

         if (targetHistoryId && this.history[targetHistoryId]) {
             if (!text.startsWith("Произошла ошибка")) { // Не сохраняем ошибки API
                 this.history[targetHistoryId].push({ role: role, content: text });
                 console.log(`Сообщение добавлено в историю ${targetHistoryId}:`, { role: role, content: text.substring(0, 50) + '...' });
                 const MAX_HISTORY = 20;
                 if (this.history[targetHistoryId].length > MAX_HISTORY) {
                     this.history[targetHistoryId] = this.history[targetHistoryId].slice(-MAX_HISTORY);
                 }
             }
         } else if (sender === 'user' && this.chatMode === 'dual' && this.selectedPsychologists.length === 2) {
             this.selectedPsychologists.forEach(psych => {
                 if (this.history[psych.id]) {
                     this.history[psych.id].push({ role: 'user', content: text });
                     console.log(`Сообщение USER добавлено в историю ${psych.id}`);
                     const MAX_HISTORY = 20;
                     if (this.history[psych.id].length > MAX_HISTORY) {
                         this.history[psych.id] = this.history[psych.id].slice(-MAX_HISTORY);
                     }
                 }
             });
         } else {
             console.warn("Не удалось определить психолога для сохранения истории:", {sender, psychologistId, mode: this.chatMode});
         }
         // --------------------------------------

        // Подсветка терминов (если включена)
        if (this.highlightEnabled) {
            // Логика подсветки
        }
    }

    // Вспомогательная функция для создания элемента сообщения (для dual mode user)
    createMessageElement(sender, text) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(sender === 'user' ? 'user-message' : 'psychologist-message');
        messageElement.textContent = text;
        return messageElement;
    }

    // Вспомогательная функция добавления и скролла
    appendAndScroll(container, element) {
         if (container && element) {
             container.appendChild(element);
             // Плавный скролл
             container.scrollTo({
                 top: container.scrollHeight,
                 behavior: 'smooth'
             });
         }
    }

    async sendMessage() {
        if (!this.elements || this.isProcessing) return;

        const userMessage = this.elements.userInput.value.trim();
        if (!userMessage) return;

        this.isProcessing = true;
        this.elements.sendButton.disabled = true;
        this.elements.userInput.disabled = true;
        console.log('Отправка сообщения:', userMessage);

        // Отображаем сообщение пользователя СРАЗУ
        this.displayMessage('user', userMessage);
        this.elements.userInput.value = ''; // Очищаем поле ввода
        this.elements.userInput.style.height = 'auto'; // Сбрасываем высоту textarea

        try {
            if (this.chatMode === 'single' && this.selectedPsychologists[0]) {
                const psych = this.selectedPsychologists[0];
                const currentHistory = this.history[psych.id] || [];
                const response = await window.api.getAIResponse(psych.id, userMessage, currentHistory);
                this.displayMessage('psychologist', response, psych.id);
            } else if (this.chatMode === 'dual' && this.selectedPsychologists.length === 2) {
                const promises = this.selectedPsychologists.map(async (psych) => {
                    try {
                        const currentHistory = this.history[psych.id] || [];
                        const response = await window.api.getAIResponse(psych.id, userMessage, currentHistory);
                        return { id: psych.id, response: response };
                    } catch (error) {
                        return { id: psych.id, error: error };
                    }
                });
                const results = await Promise.all(promises);
                results.forEach(result => {
                    if (result.response) {
                        this.displayMessage('psychologist', result.response, result.id);
                    } else if (result.error) {
                        this.displayMessage('psychologist', `К сожалению, произошла ошибка: ${result.error.message}`, result.id);
                        console.error(`Ошибка API для ${result.id}:`, result.error);
                    }
                });
            } else {
                 console.warn('Попытка отправить сообщение в некорректном состоянии чата.');
                 this.displayError('Не выбран психолог для ответа.');
            }
        } catch (error) { // Ловим ошибки, которые не были пойманы внутри map/Promise.all
            console.error('Общая ошибка при отправке/обработке сообщения:', error);
            this.displayError(error.message || 'Не удалось получить ответ от ИИ.');
        } finally {
            this.isProcessing = false;
            this.elements.sendButton.disabled = false;
            this.elements.userInput.disabled = false;
            this.elements.userInput.focus();
        }
    }

    toggleHighlight(enabled) {
        this.highlightEnabled = enabled;
        console.log(`Подсветка терминов ${enabled ? 'включена' : 'выключена'}.`);
        // Логика перерисовки сообщений
    }

    displayError(message) {
        console.error('Отображение ошибки пользователю:', message);
        // Простой alert или можно создать кастомный элемент для ошибок
        alert(`Ошибка: ${message}`);
    }

    scrollToBottom() {
        if (!this.elements) return;
        setTimeout(() => { // Небольшая задержка для рендера
             if (this.chatMode === 'single' && this.elements.chatMessagesSingle) {
                 this.elements.chatMessagesSingle.scrollTo({ top: this.elements.chatMessagesSingle.scrollHeight, behavior: 'smooth' });
             } else if (this.chatMode === 'dual' && this.elements.chatColumnsElements && this.elements.chatColumnsElements.length > 0) {
                 this.elements.chatColumnsElements.forEach(col => {
                     const msgCol = col.querySelector('.chat-messages-column');
                     if (msgCol) {
                          msgCol.scrollTo({ top: msgCol.scrollHeight, behavior: 'smooth' });
                     }
                 });
             }
        }, 100);
    }
    initializeEventHandlers() {
         if (!this.elements) {
             console.error("Элементы DOM не инициализированы перед вызовом initializeEventHandlers");
             return;
         }

         const addPsychButton = this.elements.addPsychologistBtn;
         const psychList = this.elements.psychologistsList;
         const highlightCheckbox = this.elements.highlightToggle;

         // --- Обработчик для кнопки добавления/выбора второго психолога ---
         if (addPsychButton) {
             addPsychButton.addEventListener('click', () => {
                 if (this.chatMode === 'single') {
                     this.addSecondPsychologist();
                 } else {
                    if (psychList) {
                         console.log('Открываем список для выбора второго психолога');
                         this.initializePsychologistsList();
                         psychList.classList.remove('hidden');
                    }
                 }
             });
         }

         // --- Обработчик для чекбокса подсветки терминов ---
         if (highlightCheckbox) {
             highlightCheckbox.checked = this.highlightEnabled;
             highlightCheckbox.addEventListener('change', (e) => {
                 this.toggleHighlight(e.target.checked);
             });
         }

         // --- Обработчики для списка психологов (выбор) ---
         if (psychList) {
             psychList.addEventListener('click', (e) => {
                 const psychItem = e.target.closest('.psychologist-list-item');
                 if (psychItem && psychItem.dataset.id) {
                     this.selectPsychologist(psychItem.dataset.id);
                     psychList.classList.add('hidden');
                 }
             });
         }
         //--- Обработчик для кнопки отправки ---
         if (this.elements.sendButton && this.elements.userInput) {
             this.elements.sendButton.addEventListener('click', () => this.sendMessage());
             this.elements.userInput.addEventListener('keypress', (e) => {
                 if (e.key === 'Enter' && !e.shiftKey) {
                     e.preventDefault();
                     this.sendMessage();
                 }
             });

             this.elements.userInput.addEventListener('input', () => {
                 const text = this.elements.userInput.value;
                 this.elements.sendButton.disabled = text.trim().length === 0;
                 this.elements.userInput.style.height = 'auto';
                 this.elements.userInput.style.height = (this.elements.userInput.scrollHeight) + 'px';
             });
             this.elements.sendButton.disabled = this.elements.userInput.value.trim().length === 0; // Изначальное состояние
         }

        // --- Обработчик для клика вне списка психологов (закрытие списка) ---
         // Можно добавить, если нужно
     } // Закрываем initializeEventHandlers
} // Закрываем класс PsychoChat

// Инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    if (!window.psychoChatApp) {
         console.log('DOM загружен, инициализация PsychoChat App...');
         try {
             window.psychoChatApp = new PsychoChat();
             window.psychoChatApp.init();
         } catch (appInitError) {
             console.error('КРИТИЧЕСКАЯ ОШИБКА при создании экземпляра PsychoChat:', appInitError);
             alert('Критическая ошибка при инициализации приложения: ' + appInitError.message);
         }
    } else {
         console.log('PsychoChat App уже инициализирован.');
    }
});
