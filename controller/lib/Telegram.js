const { axiosInstance } = require("./axios");
const { 
    saveUser, 
    getUser, 
    isUserRegistered, 
    saveOTP, 
    getOTP, 
    deleteOTP,
    setUserSession,
    getUserSession,
    deleteUserSession
} = require("./database");
const { generateOTP, sendSMS } = require("./otpService");
const { analyzeImage } = require("./geminiService");

function sendMessage(chatId, messageText, options = {}) {
    return axiosInstance.get("sendMessage", {
        chat_id: chatId,
        text: messageText,
        parse_mode: "HTML",
        ...options
    });
}

function sendPhoto(chatId, photo, caption = "") {
    return axiosInstance.post("sendPhoto", {
        chat_id: chatId,
        photo: photo,
        caption: caption
    });
}

function createInlineKeyboard(buttons) {
    return {
        reply_markup: {
            inline_keyboard: buttons
        }
    };
}

function createKeyboard(buttons) {
    return {
        reply_markup: {
            keyboard: buttons,
            resize_keyboard: true,
            one_time_keyboard: true
        }
    };
}

async function handleStart(messageObj) {
    const chatId = messageObj.chat.id;
    const userId = messageObj.from.id;
    
    const welcomeMessage = `
🤖 <b>Добро пожаловать в бот учета коммунальных услуг!</b>

Этот бот поможет вам:
• Зарегистрироваться в системе
• Отправлять показания счетчиков
• Просматривать профиль
• Получать помощь

Доступные команды:
/start - Начать работу
/help - Помощь
/register - Регистрация
/profile - Профиль
/sendIndication - Отправить показания
`;

    return sendMessage(chatId, welcomeMessage);
}

async function handleHelp(messageObj) {
    const chatId = messageObj.chat.id;
    
    const helpMessage = `
📋 <b>Доступные команды:</b>

/start - Начальная информация и приветствие
/help - Список всех команд с описанием
/register - Регистрация нового пользователя
/profile - Просмотр информации профиля
/sendIndication - Отправка показаний счетчиков (с фото)

<b>Как пользоваться:</b>
1. Сначала зарегистрируйтесь командой /register
2. Подтвердите номер телефона кодом из SMS
3. Используйте /sendIndication для отправки показаний
4. Просматривайте профиль командой /profile
`;

    return sendMessage(chatId, helpMessage);
}

async function handleRegister(messageObj) {
    const chatId = messageObj.chat.id;
    const userId = messageObj.from.id;
    
    if (isUserRegistered(userId)) {
        const logoutButton = createInlineKeyboard([[
            { text: "🚪 Выйти из аккаунта", callback_data: "logout" }
        ]]);
        
        return sendMessage(chatId, 
            "✅ Вы уже зарегистрированы в системе.\n\nХотите выйти из аккаунта?", 
            logoutButton
        );
    }
    
    setUserSession(userId, { step: "name" });
    return sendMessage(chatId, "📝 Начинаем регистрацию.\n\nВведите ваше имя:");
}

async function handleProfile(messageObj) {
    const chatId = messageObj.chat.id;
    const userId = messageObj.from.id;
    
    if (!isUserRegistered(userId)) {
        return sendMessage(chatId, "❌ Вы не зарегистрированы. Используйте команду /register");
    }
    
    const user = getUser(userId);
    const profileMessage = `
👤 <b>Ваш профиль:</b>

<b>Имя:</b> ${user.name}
<b>Фамилия:</b> ${user.surname}
<b>Телефон:</b> ${user.phone}
<b>ИИН:</b> ${user.iin}
<b>Лицевой счет:</b> ${user.personalAccount}
<b>Адрес:</b> ${user.address}
<b>Дата регистрации:</b> ${new Date(user.registrationDate).toLocaleDateString()}
`;

    return sendMessage(chatId, profileMessage);
}

async function handleSendIndication(messageObj) {
    const chatId = messageObj.chat.id;
    const userId = messageObj.from.id;
    
    if (!isUserRegistered(userId)) {
        return sendMessage(chatId, "❌ Вы не зарегистрированы. Используйте команду /register");
    }
    
    setUserSession(userId, { step: "waiting_photo" });
    return sendMessage(chatId, "📸 Отправьте фотографию показаний счетчика:");
}

async function handleRegistrationStep(messageObj) {
    const chatId = messageObj.chat.id;
    const userId = messageObj.from.id;
    const text = messageObj.text;
    const session = getUserSession(userId);
    
    if (!session) return;
    
    switch (session.step) {
        case "name":
            session.userData = { name: text };
            session.step = "surname";
            setUserSession(userId, session);
            return sendMessage(chatId, "Введите вашу фамилию:");
            
        case "surname":
            session.userData.surname = text;
            session.step = "phone";
            setUserSession(userId, session);
            return sendMessage(chatId, "Введите номер телефона (формат: +7XXXXXXXXXX):");
            
        case "phone":
            if (!/^\+7\d{10}$/.test(text)) {
                return sendMessage(chatId, "❌ Неверный формат номера. Используйте формат: +7XXXXXXXXXX");
            }
            session.userData.phone = text;
            session.step = "iin";
            setUserSession(userId, session);
            return sendMessage(chatId, "Введите ваш ИИН (12 цифр):");
            
        case "iin":
            if (!/^\d{12}$/.test(text)) {
                return sendMessage(chatId, "❌ ИИН должен содержать 12 цифр");
            }
            session.userData.iin = text;
            session.step = "personal_account";
            setUserSession(userId, session);
            return sendMessage(chatId, "Введите номер лицевого счета:");
            
        case "personal_account":
            session.userData.personalAccount = text;
            session.step = "address";
            setUserSession(userId, session);
            return sendMessage(chatId, "Введите ваш адрес:");
            
        case "address":
            session.userData.address = text;
            session.step = "otp_sending";
            setUserSession(userId, session);
            
            // Generate and send OTP
            const otp = generateOTP();
            saveOTP(session.userData.phone, otp);
            
            try {
                await sendSMS(session.userData.phone, `Ваш код подтверждения: ${otp}`);
                session.step = "otp_verification";
                setUserSession(userId, session);
                return sendMessage(chatId, `📱 SMS с кодом подтверждения отправлено на номер ${session.userData.phone}\n\nВведите код из SMS:`);
            } catch (error) {
                deleteUserSession(userId);
                return sendMessage(chatId, "❌ Ошибка отправки SMS. Попробуйте снова.");
            }
            
        case "otp_verification":
            const storedOTP = getOTP(session.userData.phone);
            if (!storedOTP || storedOTP.code !== text) {
                return sendMessage(chatId, "❌ Неверный код. Попробуйте еще раз:");
            }
            
            // Check OTP expiration (5 minutes)
            if (Date.now() - storedOTP.timestamp > 5 * 60 * 1000) {
                deleteOTP(session.userData.phone);
                deleteUserSession(userId);
                return sendMessage(chatId, "❌ Код истек. Начните регистрацию заново с команды /register");
            }
            
            // Save user
            const userData = {
                ...session.userData,
                userId: userId,
                registrationDate: Date.now()
            };
            saveUser(userId, userData);
            deleteOTP(session.userData.phone);
            deleteUserSession(userId);
            
            return sendMessage(chatId, "✅ Регистрация успешно завершена!\n\nТеперь вы можете использовать все функции бота.");
    }
}

async function handlePhotoIndication(messageObj) {
    const chatId = messageObj.chat.id;
    const userId = messageObj.from.id;
    const session = getUserSession(userId);
    
    if (!session || session.step !== "waiting_photo") {
        return;
    }
    
    try {
        // Get photo file
        const photo = messageObj.photo[messageObj.photo.length - 1]; // Get highest resolution
        const fileResponse = await axiosInstance.get("getFile", { file_id: photo.file_id });
        const filePath = fileResponse.data.result.file_path;
        
        // Download photo
        const photoResponse = await axiosInstance.get(filePath, {}, { responseType: 'arraybuffer' });
        const photoBase64 = Buffer.from(photoResponse.data).toString('base64');
        
        // Analyze with Gemini
        sendMessage(chatId, "⏳ Анализирую показания счетчика...");
        
        const numbers = await analyzeImage(photoBase64);
        
        // Store analyzed data in session
        session.step = "confirm_numbers";
        session.numbers = numbers;
        setUserSession(userId, session);
        
        const confirmButtons = createInlineKeyboard([
            [
                { text: "✅ Да, верно", callback_data: "confirm_numbers" },
                { text: "❌ Нет, неверно", callback_data: "reject_numbers" }
            ]
        ]);
        
        return sendMessage(chatId, 
            `🔍 <b>Обнаруженные показания:</b>\n\n${numbers}\n\n<b>Показания верны?</b>`, 
            confirmButtons
        );
        
    } catch (error) {
        console.error("Error processing photo:", error);
        deleteUserSession(userId);
        return sendMessage(chatId, "❌ Ошибка обработки фотографии. Попробуйте еще раз с командой /sendIndication");
    }
}

async function handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    
    // Answer callback query
    axiosInstance.get("answerCallbackQuery", { callback_query_id: callbackQuery.id });
    
    switch (data) {
        case "logout":
            if (isUserRegistered(userId)) {
                saveUser(userId, null);
                users.delete(userId);
                return sendMessage(chatId, "✅ Вы успешно вышли из аккаунта.");
            }
            break;
            
        case "confirm_numbers":
            const session = getUserSession(userId);
            if (session && session.step === "confirm_numbers") {
                // Log the indication
                const user = getUser(userId);
                console.log(`📊 INDICATION SENT - User: ${user.name} ${user.surname}, Phone: ${user.phone}, Numbers: ${session.numbers}, Time: ${new Date().toISOString()}`);
                
                deleteUserSession(userId);
                return sendMessage(chatId, "✅ Показания успешно отправлены!\n\nСпасибо за использование нашего сервиса.");
            }
            break;
            
        case "reject_numbers":
            deleteUserSession(userId);
            return sendMessage(chatId, "❌ Попробуйте сделать более четкое фото показаний счетчика.\n\nИспользуйте команду /sendIndication для повторной отправки.");
    }
}

async function handleMessage(messageObj) {
    // Handle callback queries
    if (messageObj.callback_query) {
        return handleCallbackQuery(messageObj.callback_query);
    }
    
    // Handle regular messages
    if (messageObj.message) {
        messageObj = messageObj.message;
    }
    
    if (!messageObj || typeof messageObj !== "object" || !messageObj.chat) {
        console.warn("⚠️ Invalid message object received:", messageObj);
        return;
    }

    const chatId = messageObj.chat.id;
    const userId = messageObj.from.id;
    const messageText = messageObj.text;
    
    // Handle photo messages
    if (messageObj.photo) {
        return handlePhotoIndication(messageObj);
    }
    
    // Handle text messages
    if (!messageText) return;
    
    // Handle commands
    if (messageText.startsWith("/")) {
        const command = messageText.substring(1);
        switch (command) {
            case "start":
                return handleStart(messageObj);
            case "help":
                return handleHelp(messageObj);
            case "register":
                return handleRegister(messageObj);
            case "profile":
                return handleProfile(messageObj);
            case "sendIndication":
                return handleSendIndication(messageObj);
            default:
                return sendMessage(chatId, "❌ Неизвестная команда. Используйте /help для списка команд.");
        }
    }
    
    // Handle registration steps
    const session = getUserSession(userId);
    if (session && session.step && session.step !== "waiting_photo") {
        return handleRegistrationStep(messageObj);
    }
    
    // Default echo response
    return sendMessage(chatId, "Используйте /help для списка доступных команд.");
}

module.exports = { handleMessage };