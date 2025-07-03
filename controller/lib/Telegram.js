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
const User = require("../../models/User");
const axios = require("axios");
const { saveIndication } = require('./database');
require("dotenv").config(); // чтобы .env подхватился
const BOT_TOKEN = process.env.MY_TOKEN; // чтобы BOT_TOKEN получил значение



function sendMessage(chatId, messageText, options = {}) {
    return axiosInstance.get("sendMessage", {
        chat_id: chatId,
        text: messageText,
        parse_mode: "HTML",
        ...options
    });
}

function createInlineKeyboard(buttons) {
    return {
        reply_markup: {
            inline_keyboard: buttons
        }
    };
}

async function handleStart(messageObj) {
    const chatId = messageObj.chat.id;

    const welcomeMessage = `
🤖 <b>Добро пожаловать в бот учета коммунальных услуг!</b>

Доступные команды:
/start - Начать работу
/help - Помощь
/register - Регистрация
/login - Вход в систему
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
/login - Вход для зарегистрированных
/profile - Просмотр профиля
/sendIndication - Отправка показаний

<b>Как пользоваться:</b>
1️⃣ Сначала зарегистрируйтесь (/register)  
2️⃣ Или войдите в систему (/login)  
3️⃣ Затем отправляйте показания и просматривайте профиль  
`;

    return sendMessage(chatId, helpMessage);
}

async function handleRegister(messageObj) {
    const chatId = messageObj.chat.id;
    const userId = messageObj.from.id;

    const existingUser = await getUser(userId);
    if (existingUser) {
        return sendMessage(chatId, 
            "✅ У вас уже есть аккаунт. Используйте /logout чтобы выйти или /login чтобы войти.");
    }

    setUserSession(userId, { step: "name" });
    return sendMessage(chatId, "📝 Начинаем регистрацию.\n\nВведите ваше имя:");
}


async function handleLogin(messageObj) {
    const chatId = messageObj.chat.id;
    const userId = messageObj.from.id;

    if (!(await isUserRegistered(userId))) {
        return sendMessage(chatId, "❌ Вы не зарегистрированы. Сначала выполните /register");
    }

    setUserSession(userId, { step: "login_phone" });
    return sendMessage(chatId, "Введите ваш номер телефона (формат: +7XXXXXXXXXX):");
}

async function handleLoginStep(messageObj) {
    const chatId = messageObj.chat.id;
    const userId = messageObj.from.id;
    const text = messageObj.text;
    const session = getUserSession(userId);
    if (!session) return;

    switch (session.step) {
        case "login_phone":
            if (!/^\+7\d{10}$/.test(text)) {
                return sendMessage(chatId, "❌ Неверный формат. Формат: +7XXXXXXXXXX");
            }
            const user = await getUser(userId);
            if (!user || user.phone !== text) {
                return sendMessage(chatId, "❌ Номер не совпадает с зарегистрированным");
            }

            const otp = generateOTP();
            saveOTP(text, otp);
            await sendSMS(text, `Ваш код для входа: ${otp}`);
            session.phone = text;
            session.step = "login_otp";
            setUserSession(userId, session);
            return sendMessage(chatId, "📱 Код отправлен. Введите код:");

        case "login_otp":
            const storedOTP = getOTP(session.phone);
            if (!storedOTP || storedOTP.code !== text) {
                return sendMessage(chatId, "❌ Неверный код. Попробуйте снова:");
            }
            if (Date.now() - storedOTP.timestamp > 5 * 60 * 1000) {
                deleteOTP(session.phone);
                deleteUserSession(userId);
                return sendMessage(chatId, "❌ Код истек. Запустите /login снова.");
            }

            deleteOTP(session.phone);
            deleteUserSession(userId);
            setUserSession(userId, { loggedIn: true });
            return sendMessage(chatId, "✅ Вы вошли в систему!");
    }
}

async function handleProfile(messageObj) {
    const chatId = messageObj.chat.id;
    const userId = messageObj.from.id;
    const session = getUserSession(userId);

    if (!session || !session.loggedIn) {
        return sendMessage(chatId, "❌ Сначала выполните вход (/login)");
    }

    const user = await getUser(userId);
    const msg = `
👤 <b>Ваш профиль:</b>
<b>Имя:</b> ${user.name}
<b>Фамилия:</b> ${user.surname}
<b>Телефон:</b> ${user.phone}
<b>ИИН:</b> ${user.iin}
<b>Лицевой счет:</b> ${user.personalAccount}
<b>Адрес:</b> ${user.address}
<b>Дата регистрации:</b> ${new Date(user.registrationDate).toLocaleDateString()}
`;
    return sendMessage(chatId, msg);
}

async function handleSendIndication(messageObj) {
    const chatId = messageObj.chat.id;
    const userId = messageObj.from.id;

    if (!(await isUserRegistered(userId))) {
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

            const existingUserByPhone = await User.findOne({ phone: text });
            if (existingUserByPhone) {
                deleteUserSession(userId);
                return sendMessage(chatId, "❌ Этот номер уже зарегистрирован. Пожалуйста, используйте /login чтобы войти.");
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

            if (Date.now() - storedOTP.timestamp > 5 * 60 * 1000) {
                deleteOTP(session.userData.phone);
                deleteUserSession(userId);
                return sendMessage(chatId, "❌ Код истек. Начните регистрацию заново с команды /register");
            }

            const userData = {
                ...session.userData,
                userId: userId,
                registrationDate: Date.now()
            };
            
            console.log("➡️ Сохраняем пользователя:", userData);
            await saveUser(userId, userData);
            deleteOTP(session.userData.phone);
            deleteUserSession(userId);

            return sendMessage(chatId, "✅ Регистрация успешно завершена!\n\nТеперь вы можете использовать все функции бота.");
    }
    if (session.step === "login_phone") {
    if (!/^\+7\d{10}$/.test(text)) {
        return sendMessage(chatId, "❌ Неверный формат номера. Используйте формат: +7XXXXXXXXXX");
    }
    const user = await getUser(userId);
    if (!user || user.phone !== text) {
        return sendMessage(chatId, "❌ Телефон не совпадает с зарегистрированным. Попробуйте снова.");
    }

    session.phone = text;
    const otp = generateOTP();
    saveOTP(text, otp);

    await sendSMS(text, `Ваш код для входа: ${otp}`);
    session.step = "login_otp";
    setUserSession(userId, session);
    return sendMessage(chatId, "📱 SMS с кодом отправлено. Введите код:");
}

if (session.step === "login_otp") {
    const storedOTP = getOTP(session.phone);
    if (!storedOTP || storedOTP.code !== text) {
        return sendMessage(chatId, "❌ Неверный код. Попробуйте снова:");
    }

    if (Date.now() - storedOTP.timestamp > 5 * 60 * 1000) {
        deleteOTP(session.phone);
        deleteUserSession(userId);
        return sendMessage(chatId, "❌ Код истек. Пожалуйста, начните вход заново с /login.");
    }

    deleteOTP(session.phone);
    deleteUserSession(userId);

    setUserSession(userId, { loggedIn: true });
    return sendMessage(chatId, "✅ Вы успешно вошли в систему!");
}
}

async function handleLogin(messageObj) {
    const chatId = messageObj.chat.id;
    const userId = messageObj.from.id;

    if (!(await isUserRegistered(userId))) {
        return sendMessage(chatId, "❌ Вы не зарегистрированы. Пожалуйста, используйте /register сначала.");
    }

    setUserSession(userId, { step: "login_phone" });
    return sendMessage(chatId, "Введите ваш номер телефона для входа (формат: +7XXXXXXXXXX):");
}

async function handleLogout(messageObj) {
    const chatId = messageObj.chat.id;
    const userId = messageObj.from.id;

    const user = await getUser(userId);
    if (!user) {
        return sendMessage(chatId, "❌ Вы не были зарегистрированы.");
    }

    await saveUser(userId, null);  // удаление из базы
    deleteUserSession(userId);     // очистка сессии
    return sendMessage(chatId, "✅ Вы успешно вышли из системы.");
}


async function downloadFileAsBase64(fileUrl) {
  const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);
  return buffer.toString('base64');
}

async function handlePhotoIndication(messageObj) {
  const chatId = messageObj.chat.id;
  const userId = messageObj.from.id;
  const session = getUserSession(userId);

  if (!session || session.step !== "waiting_photo") return;

  try {
    const fileId = messageObj.photo[messageObj.photo.length - 1].file_id;
    const fileInfo = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
    const filePath = fileInfo.data.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    
    const base64Data = await downloadFileAsBase64(fileUrl);

    sendMessage(chatId, "⏳ Анализирую показания счетчика...");
    const numbers = await analyzeImage(base64Data);
    
    if (!numbers) {
        deleteUserSession(userId);
        return sendMessage(chatId, "❌ Не удалось распознать цифры. Попробуйте снова с /sendIndication");
    }

    session.step = "confirm_numbers";
    session.numbers = numbers.slice(0, 5);
    session.photoPath = fileUrl;
    setUserSession(userId, session);

    const confirmButtons = createInlineKeyboard([
      [
        { text: "✅ Да, верно", callback_data: "confirm_numbers" },
        { text: "❌ Нет, неверно", callback_data: "reject_numbers" }
      ]
    ]);

    return sendMessage(chatId, `🔍 <b>Обнаруженные показания:</b>\n\n${session.numbers}\n\n<b>Показания верны?</b>`, confirmButtons);

  } catch (err) {
    console.error("❌ Ошибка обработки фотографии:", err);
    deleteUserSession(userId);
    return sendMessage(chatId, "❌ Ошибка обработки фотографии. Попробуйте снова с /sendIndication");
  }
}





async function handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    axiosInstance.get("answerCallbackQuery", { callback_query_id: callbackQuery.id });

    switch (data) {
        case "logout":
            if (await isUserRegistered(userId)) {
                await saveUser(userId, null);
                return sendMessage(chatId, "✅ Вы успешно вышли из аккаунта.");
            }
            break;

        case "confirm_numbers":
            const session = getUserSession(userId);
            if (session && session.step === "confirm_numbers") {
                await saveIndication({
                    userId: userId,
                    numbers: session.numbers,
                    photoPath: session.photoPath,
                    timestamp: new Date()
                });

                deleteUserSession(userId);
                return sendMessage(chatId, "✅ Показания успешно отправлены!\n\nСпасибо за использование нашего сервиса.");
            }
            break;


        case "reject_numbers":
            deleteUserSession(userId);
            return sendMessage(chatId, "❌ Попробуйте сделать более четкое фото.\n\nИспользуйте команду /sendIndication для повторной отправки.");
    }
}

async function handleMessage(messageObj) {
    if (messageObj.callback_query) {
        return handleCallbackQuery(messageObj.callback_query);
    }

    if (messageObj.message) {
        messageObj = messageObj.message;
    }

    if (!messageObj || typeof messageObj !== "object" || !messageObj.chat) {
        console.warn("⚠️ Invalid message object received:", messageObj);
        return;
    }

    const userId = messageObj.from.id;
    const messageText = messageObj.text;

    if (messageObj.photo) {
        return handlePhotoIndication(messageObj);
    }

    if (!messageText) return;

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
        case "login":
            return handleLogin(messageObj);
        case "logout":
            return handleLogout(messageObj);
        default:
            return sendMessage(messageObj.chat.id, "❌ Неизвестная команда. Используйте /help для списка команд.");
    }
}


    const session = getUserSession(userId);
    if (session && session.step && session.step !== "waiting_photo") {
        return handleRegistrationStep(messageObj);
    }

    return sendMessage(messageObj.chat.id, "Используйте /help для списка доступных команд.");
}

module.exports = { handleMessage };
