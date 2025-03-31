class PsychoChat {
    constructor() {
        this.selectedPsychologists = [];
        this.chatMode = 'single';
        this.highlightEnabled = false;
        this.isProcessing = false;
        this.appConfig = null;
    }

    initializeEventHandlers() {
        console.log('Инициализация обработчиков событий');
        
        // Сначала очищаем старые обработчики
        const addPsychButton = document.querySelector('.add-psychologist-btn');
        const psychList = document.querySelector('.psychologists-list');
        const highlightCheckbox = document.querySelector('#highlightTerms');

        if (addPsychButton) {
            // Полностью заменяем кнопку новой
            const newAddPsychButton = addPsychButton.cloneNode(true);
            addPsychButton.parentNode.replaceChild(newAddPsychButton, addPsychButton);
            
            // Добавляем новый обработчик
            newAddPsychButton.addEventListener('click', () => {
                const list = document.querySelector('.psychologists-list');
                if (list) {
                    console.log('Открываем список психологов');
                    // Обновляем список перед показом
                    this.initializePsychologistsList();
                    list.classList.remove('hidden');
                }
            });
        }

        // Обновляем список психологов и его обработчики
        this.initializePsychologistsList();

        // Обработчик для чекбокса подсветки терминов
        if (highlightCheckbox) {
            highlightCheckbox.checked = false;
            highlightCheckbox.addEventListener('change', (e) => {
                this.toggleHighlight(e.target.checked);
            });
        }

        // Обработчики для списка психологов
        if (psychList) {
            // Удаляем все старые обработчики
            const newPsychList = psychList.cloneNode(true);
            psychList.parentNode.replaceChild(newPsychList, psychList);
            
            // Заново добавляем всех психологов в список
            this.initializePsychologistsList();
            
            newPsychList.addEventListener('click', (e) => {
                const psychItem = e.target.closest('.psychologist-list-item');
                if (psychItem && psychItem.dataset.id) {
                    this.selectPsychologist(psychItem.dataset.id);
                    newPsychList.classList.add('hidden');
                }
            });
        }

        // Обработчики для формы отправки сообщений
        const chatInput = document.querySelector('.chat-input textarea');
        const sendButton = document.querySelector('.chat-input .send-button');

        if (chatInput && sendButton) {
            // Активация/деактивация кнопки отправки
            chatInput.addEventListener('input', () => {
                sendButton.disabled = !chatInput.value.trim();
            });

            // Функция отправки сообщения
            const handleSubmit = () => {
                const message = chatInput.value.trim();
                if (message) {
                    this.handleUserMessage(message);
                    chatInput.value = '';
                    sendButton.disabled = true;
                }
            };

            // Отправка по клику на кнопку
            sendButton.addEventListener('click', handleSubmit);

            // Отправка по Enter (но Shift+Enter для новой строки)
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                }
            });
        }
    }

    get selectedPsychologist() {
        return this.selectedPsychologists[0] || null;
    }

    set selectedPsychologist(value) {
        this.selectedPsychologists = value ? [value] : [];
    }

    async init() {
        console.log('PsychoChat.init() started...');
        
        try {
            // Ждем инициализации API
            let attempts = 0;
            while (!window.api && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (!window.api) {
                throw new Error('API не инициализирован после нескольких попыток');
            }

            // Проверяем подключение к серверу
            const isServerAvailable = await window.api.testConnection();
            if (!isServerAvailable) {
                throw new Error('Сервер модели недоступен. Убедитесь что сервер запущен на localhost:1234');
            }

            // Загружаем конфигурацию
            this.updateStatus('Загрузка конфигурации...');
            

            console.log('Загруженные психологи:', this.appConfig.psychologists);

            // Инициализируем интерфейс
            this.initializePsychologistsList();

            // Проверяем URL параметры
            const params = new URLSearchParams(window.location.search);
            const psychId = params.get('psychologist') || params.get('character'); // Поддержка обоих параметров
            const mode = params.get('mode');

            // Initialize the selected psychologist based on URL parameters
            if (psychId) {
                const psychIds = psychId.split(',');
                if (psychIds.length > 1 && mode === 'dual') {
                    this.selectPsychologist(psychIds[0]);
                    this.selectPsychologist(psychIds[1]);
                } else {
                    this.selectPsychologist(psychIds[0]);
                }
            } else if (this.appConfig.psychologists.length > 0) {
                this.selectPsychologist(this.appConfig.psychologists[0].id);
            }
