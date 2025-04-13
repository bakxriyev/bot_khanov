import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

// Bot token
const token = process.env.TELEGRAM_BOT_TOKEN || '7898538816:AAGsvkzD5vfBy1289lvq3w_7b9HuuHd2RWw';
const bot = new TelegramBot(token, {polling: true});

// Backend API URL - replace with your actual backend
const API_URL = process.env.API_URL || 'http://localhost:5010';

// Admin group ID for payment confirmations
const ADMIN_GROUP_ID = process.env.ADMIN_GROUP_ID || '-4631952717';

// Store user data
const userPhoneNumbers = {}; 
const userStates = {}; 
const userReminders = {};
const paymentConfirmations = {};
const userIds = {}; // Store database user IDs

// Course information with images
const courses = {
    1: {
        name: 'Birinchi qadam',
        price: '699000',
        display_price: '699 000 UZS',
        description: `📌 Savdo sohasiga kirish\n- Mijoz psixologiyasi\n- Asosiy muloqot ko'nikmalari\n- Sotuv terminologiyasi\n- Modullar soni: 4 ta\n- 16+ ta video dars\n- Yopiq telegram guruhga kirish`,
        paymentLink: 'http://checkout.paycom.uz/bT02N2VmZGRkN2VkMTdkNjU4M2FhMzcyMGQ7YWMuZnVsbF9uYW1lPXRlc3RldGVzdDthYy5jb3Vyc2U9dGVzdHRlc3Q7YT0xMDAwMA==',
        image: 'https://example.com/course1.jpg',
        telegramLink: 'https://t.me/+abcdefghijklmn'
    },
    2: {
        name: 'Ishga tayyor',
        price: '899000',
        display_price: '899 000 UZS',
        description: `📌 "Birinchi qadam" tarifidan barcha mavzular\n- Mijoz qarshiliklari bilan ishlash\n- CRM va IP Telefoniya tizimlarida ishlash\n- Asosiy script tuzish texnikalari, scriptlar bilan ishlash\n- Modullar soni: 6 ta\n- 21+ video darslik`,
        paymentLink: 'https://payme.uz/ishga_tayyor',
        image: 'https://example.com/course2.jpg',
        telegramLink: 'https://t.me/+opqrstuvwxyz'
    },
    3: {
        name: 'Mutaxassis (Pro tarifi)',
        price: '1399000',
        display_price: '1 399 000 UZS',
        description: `📌 "Birinchi qadam" tarifidan barchasi\n- "Ishga tayyor" tarifidan barcha mavzular\n- Rezyume tayyorlash\n- Ish topish yo'riqnomasi (qayerdan qanday qilib)\n- Modullar soni: 8 ta\n- 29+ video darsliklar\n- Shaxsiy rivojlanish va karyerada o'sish bo'yicha maslahatlar\n- VIP yopiq telegram guruh (faqat Pro tarifi o'quvchilar uchun)`,
        paymentLink: 'https://payme.uz/pro_tarif',
        image: 'https://example.com/course3.jpg',
        telegramLink: 'https://t.me/+123456789abc'
    }
};

// FAQ questions and answers
const faq = [
    {
        question: "Kursni sotib olsam, uni qanchalik tez o'rganib bitira olaman?",
        answer: `📌 Javob:\nBu sizning tezligingiz va vaqtingizga bog'liq. Kurs modullarga bo'lingan va uni istalgan vaqtda o'tishingiz mumkin. O'rtacha o'quvchilar 7-14 kun ichida kursni yakunlab, amaliyotga o'ta boshlaydilar.\n\n✅ Sizga qulay bo'lishi uchun:\n- Darslarni istalgan vaqtda va istalgan joyda tomosha qilishingiz mumkin.\n- Kursni qayta ko'rib chiqish imkoniyati bor.\n- Har bir dars yakunida testlar va amaliy topshiriqlar bor, shuning uchun natijangizni o'zingiz nazorat qilasiz.`
    },
    {
        question: "Kursni boshlash uchun savdo bo'yicha oldindan tajribaga ega bo'lishim kerakmi?",
        answer: `📌 Javob:\nYo'q, bu kurs to'liq yangi boshlovchilarga ham unda ozmi ko'pmi tajribasi borlarga ham mo'ljallangan!\n\n✔ Savdo bo'yicha hech qanday tajribaga ega bo'lmaganlar ham ushbu kurs orqali asosiy bilimlarni egallashlari va real ishga kirishlari mumkin.\n✔ Darslar bosqichma-bosqich tushuntirilgan, hatto savdo sohasida umuman ishlamagan odam ham hammasini tushunadi.\n✔ Agar sizda tajriba bor bo'lsa, kurs sizning bilimlaringizni tizimlashtiradi va daromadingizni oshirishga yordam beradi.`
    },
    {
        question: "Kursni tugatganimdan keyin darhol ish topa olamanmi?",
        answer: `📌 Javob:\nKursning asosiy maqsadi – sizni sotuv sohasida asosiy bilimlar bilan ta'minlash\n\n✔ Kurs davomida siz rezyume yaratish, ish topish strategiyalari bo'yicha darslar olasiz.\n✔ Eng muhimi – haqiqiy amaliyot. Agar siz kursdagi bilimlarni to'liq o'zlashtirib, amalda qo'llasangiz, 3-5 mln so'm maosh bilan ish topish imkoniyatingiz katta bo'ladi.\n✔ Bundan tashqari, bizda premium tarifga ega bo'lganlar uchun eksklyuziv maslahat va rezyume ko'rib chiqish xizmati mavjud.\n\n📌 Tayyor bo'ling! Siz kursni yakunlaganingizdan so'ng, bozorga mos keladigan asosiy bilimlarga ega bo'lgan mutaxassis bo'lasiz.`
    }
];

// Main menu function
const showMainMenu = (chatId, userName = '') => {
    const greeting = userName ? `Assalomu alaykum ${userName}!` : 'Assalomu alaykum!';
    const message = `${greeting}\n\nSiz savdo sohasida yangi bilimlar olishni, daromadingizni oshirishni yoki yaxshi ish topishni xohlaysizmi?\nMen ishlab chiqgan maxsus kurs sizga tezda yangi bilimlarni o'rganishga yordam beradi!\n\n💡 Bu yerda siz tanlov qilishingiz mumkin:\n📌 1. Kurs sotib olish – kurs haqida to'liq ma'lumot.\n\n📍 Davom etish uchun pastdagi tugmalardan birini tanlang:`;
    
    const options = {
        reply_markup: {
            keyboard: [
                [{text: 'Kurs sotib olish'}],
                [{text: 'Mening ma\'lumotlarim'}],
                [{text: 'FAQ'}],
                [{text: 'Akkauntni o\'chirish'}]
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId, message, options);
};

// Show user info
const showUserInfo = async (chatId) => {
    try {
        if (!userIds[chatId]) {
            bot.sendMessage(chatId, 'Maʼlumotlaringiz topilmadi. Iltimos, /start buyrugʻini yuboring.');
            return;
        }

        const response = await axios.get(`${API_URL}/users/${userIds[chatId]}`);
        const userData = response.data;

        if (!userData) {
            bot.sendMessage(chatId, 'Sizning maʼlumotlaringiz topilmadi. Iltimos, /start buyrugʻini yuboring.');
            return;
        }

        let message = `📋 Sizning ma'lumotlaringiz:\n\n`;
        message += `👤 Ism: ${userData.full_name || 'Mavjud emas'}\n`;
        message += `📞 Telefon: ${userData.phone_number || 'Mavjud emas'}\n`;
        message += `💳 To'lov holati: ${userData.payment === 'paid' ? "To'langan" : "To'lanmagan"}\n`;
        message += `📚 Kurs: ${userData.course !== 0 ? courses[userData.course].name : 'Tanlanmagan'}\n`;
        message += `📅 Ro'yxatdan o'tgan sana: ${new Date(userData.createdAt).toLocaleDateString() || 'Mavjud emas'}`;

        bot.sendMessage(chatId, message);
    } catch (error) {
        console.error('User info error:', error);
        bot.sendMessage(chatId, 'Maʼlumotlarni olishda xatolik yuz berdi. Iltimos, qayta urinib koʻring.');
    }
};

// Show course tariffs
const showTariffs = (chatId) => {
    const message = `📌 Sizga mos kursni tanlang:`;
    
    const options = {
        reply_markup: {
            keyboard: [
                [{text: `${courses[1].name} - ${courses[1].display_price}`}],
                [{text: `${courses[2].name} - ${courses[2].display_price}`}],
                [{text: `${courses[3].name} - ${courses[3].display_price}`}],
                [{text: 'Orqaga'}]
            ],
            resize_keyboard: true
        }
    };

    bot.sendMessage(chatId, message, options);
};

// Send course info and payment link
const sendCourseInfo = (chatId, courseId) => {
    const course = courses[courseId];
    
    const message = `💰 ${course.name} – ${course.display_price}\n\n${course.description}\n\nKursni sotib olish uchun "To'lov qilish" tugmasini bosing.`;
    
    const options = {
        caption: message,
        reply_markup: {
            inline_keyboard: [
                [{text: 'Payme orqali to\'lov qilish', url: course.paymentLink}],
                [{text: 'To\'lov qildim', callback_data: `payment_made_${courseId}`}]
            ]
        }
    };
    
    // Send photo with payment button
    bot.sendPhoto(chatId, course.image, options).catch(error => {
        console.error('Send photo error:', error);
        // Fallback to text message if photo fails
        bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Payme orqali to\'lov qilish', url: course.paymentLink}],
                    [{text: 'To\'lov qildim', callback_data: `payment_made_${courseId}`}]
                ]
            }
        });
    });
    
    // Schedule special offer reminder
    if (!userReminders[chatId]) {
        userReminders[chatId] = {
            paid: false,
            courseId: courseId
        };
    }
    
    // First reminder after 1 hour
    setTimeout(() => {
        if (userReminders[chatId] && !userReminders[chatId].paid) {
            const reminderMessage = `📌 Siz hali ham kursni tanlamadingizmi?\n💡 Endi faqat bugun 10% chegirma!\n🎯 O'z kelajagingizga investitsiya qilish vaqti keldi!`;
            bot.sendMessage(chatId, reminderMessage);
        }
    }, 3600000); // 1 hour
    
    // Second reminder after 2 hours with video
    setTimeout(() => {
        if (userReminders[chatId] && !userReminders[chatId].paid) {
            bot.sendMessage(chatId, 'Bizning bitiruvchilarimiz natijalari bilan tanishing!');
        }
    }, 7200000); // 2 hours
    
    // Third reminder after 12 hours
    setTimeout(() => {
        if (userReminders[chatId] && !userReminders[chatId].paid) {
            bot.sendMessage(chatId, 'Kursni kirish qismini ko\'ring va bu kurs sizga to\'g\'ri keladimi bilib oling.', {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Kursni ko\'rish', url: 'https://example.com/preview'}]
                    ]
                }
            });
        }
    }, 43200000); // 12 hours
};

// Show FAQ
const showFAQ = (chatId) => {
    const options = {
        reply_markup: {
            inline_keyboard: faq.map((item, index) => {
                return [{text: item.question, callback_data: `faq_${index}`}];
            }).concat([[{text: 'Orqaga', callback_data: 'back_to_main'}]])
        }
    };
    
    bot.sendMessage(chatId, 'Tez-tez beriladigan savollar:', options);
};

// Delete account confirmation
const confirmDeleteAccount = (chatId) => {
    bot.sendMessage(chatId, 'Akkauntingizni o\'chirishni tasdiqlaysizmi?', {
        reply_markup: {
            inline_keyboard: [
                [{text: 'Ha', callback_data: 'confirm_delete_account'}],
                [{text: 'Yo\'q', callback_data: 'cancel_delete_account'}]
            ]
        }
    });
};

// Delete user account
const deleteUserAccount = async (chatId) => {
    try {
        if (!userIds[chatId]) {
            bot.sendMessage(chatId, 'Akkaunt topilmadi.');
            return;
        }

        // Delete user by ID
        await axios.delete(`${API_URL}/users/${userIds[chatId]}`);
        
        // Clear user data from memory
        delete userPhoneNumbers[chatId];
        delete userStates[chatId];
        delete userReminders[chatId];
        delete userIds[chatId];
        
        bot.sendMessage(chatId, 'Sizning akkauntingiz muvaffaqiyatli o\'chirildi. Qayta ro\'yxatdan o\'tish uchun /start buyrug\'ini yuboring.', {
            reply_markup: {
                remove_keyboard: true
            }
        });
    } catch (error) {
        console.error('Delete account error:', error);
        bot.sendMessage(chatId, 'Akkauntni o\'chirishda xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.');
    }
};

// Check if user is registered
const isUserRegistered = async (chatId) => {
    if (!userIds[chatId]) {
        bot.sendMessage(chatId, 'Iltimos, avval ro\'yxatdan o\'ting. /start buyrug\'ini yuboring.');
        return false;
    }
    
    try {
        const response = await axios.get(`${API_URL}/users/${userIds[chatId]}`);
        const userData = response.data;
        
        if (!userData) {
            bot.sendMessage(chatId, 'Sizning maʼlumotlaringiz topilmadi. Iltimos, /start buyrugʻini yuboring.');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('User check error:', error);
        bot.sendMessage(chatId, 'Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring /start buyrug\'ini yuborib.');
        return false;
    }
};

// Check if phone number is registered and handle accordingly
const checkPhoneNumberAndProceed = async (chatId, phoneNumber, telegramId, firstName, lastName, username) => {
    try {
        // Check if phone number exists in database
        const response = await axios.get(`${API_URL}/users?phone_number=${phoneNumber}`);
        const userData = response.data;
        
        if (userData && userData.length > 0) {
            // User already registered with this phone number
            userIds[chatId] = userData[0].id;
            userPhoneNumbers[chatId] = phoneNumber;
            
            // Update chat_id if it's different (user might be using a different device)
            if (userData[0].chat_id !== chatId) {
                await axios.patch(`${API_URL}/users/${userData[0].id}`, {
                    chat_id: chatId
                });
            }
            
            bot.sendMessage(chatId, `Xush kelibsiz, ${userData[0].full_name}! Siz allaqachon ro'yxatdan o'tgansiz.`);
            showMainMenu(chatId, userData[0].full_name);
            
            // Clear user state
            delete userStates[chatId];
        } else {
            // New user, proceed with registration
            userPhoneNumbers[chatId] = phoneNumber;
            userStates[chatId] = {
                step: 'registration_name',
                phoneNumber: phoneNumber,
                telegramId: telegramId,
                firstName: firstName,
                lastName: lastName,
                username: username
            };
            
            bot.sendMessage(chatId, 'Iltimos, to\'liq ism va familiyangizni kiriting:', {
                reply_markup: {
                    remove_keyboard: true
                }
            });
        }
    } catch (error) {
        console.error('Phone number check error:', error);
        bot.sendMessage(chatId, 'Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.');
    }
};

// Handle /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const username = msg.from.username || '';
    
    // Always request phone number first
    bot.sendMessage(chatId, 'Iltimos, telefon raqamingizni yuboring yoki "Telefon raqamni ulashish" tugmasini bosing:', {
        reply_markup: {
            keyboard: [
                [{
                    text: 'Telefon raqamni ulashish',
                    request_contact: true
                }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });
    
    // Save user state
    userStates[chatId] = {
        step: 'awaiting_phone',
        telegramId: telegramId,
        firstName: firstName,
        lastName: lastName,
        username: username
    };
});

// Handle callback queries (for FAQ and other inline buttons)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    if (data.startsWith('faq_')) {
        const index = parseInt(data.split('_')[1]);
        bot.sendMessage(chatId, faq[index].answer);
        bot.answerCallbackQuery(query.id);
    } else if (data === 'back_to_main') {
        const registered = await isUserRegistered(chatId);
        if (registered) {
            showMainMenu(chatId);
        }
        bot.answerCallbackQuery(query.id);
    } else if (data === 'confirm_delete_account') {
        await deleteUserAccount(chatId);
        bot.answerCallbackQuery(query.id);
    } else if (data === 'cancel_delete_account') {
        bot.sendMessage(chatId, 'Akkauntni o\'chirish bekor qilindi.');
        showMainMenu(chatId);
        bot.answerCallbackQuery(query.id);
    } else if (data.startsWith('payment_made_')) {
        const courseId = parseInt(data.split('_')[2]);
        
        // Save payment state
        userStates[chatId] = {
            step: 'awaiting_screenshot',
            courseId: courseId
        };
        
        bot.sendMessage(chatId, 'Iltimos, to\'lov chekining screenshotini yuboring:');
        bot.answerCallbackQuery(query.id);
    } else if (data.startsWith('confirm_payment_')) {
        // Admin confirmed payment
        const paymentId = data.split('_')[2];
        const paymentData = paymentConfirmations[paymentId];
        
        if (paymentData) {
            const { chatId, courseId, userId } = paymentData;
            
            // Mark as paid in database using user ID
            try {
                await axios.patch(`${API_URL}/users/${userId}`, {
                    payment: 'paid',
                    course: courseId
                });
                
                // Mark as paid in memory
                if (userReminders[chatId]) {
                    userReminders[chatId].paid = true;
                }
                
                // Send success message to user
                const course = courses[courseId];
                bot.sendMessage(chatId, `Tabriklaymiz! Sizning to'lovingiz muvaffaqiyatli qabul qilindi.\n\nSiz "${course.name}" kursini sotib oldingiz.\n\nKursga kirish uchun havola: ${course.telegramLink}`);
                
                // Notify admin group
                bot.sendMessage(ADMIN_GROUP_ID, `✅ To'lov tasdiqlandi!\n\nFoydalanuvchi: ${paymentData.fullName}\nKurs: ${course.name}\nSumma: ${course.display_price}`);
            } catch (error) {
                console.error('Payment confirmation error:', error);
                bot.sendMessage(ADMIN_GROUP_ID, `❌ To'lovni tasdiqlashda xatolik yuz berdi: ${error.message}`);
            }
            
            // Clean up
            delete paymentConfirmations[paymentId];
        }
        
        bot.answerCallbackQuery(query.id, { text: 'To\'lov tasdiqlandi!' });
    } else if (data.startsWith('reject_payment_')) {
        // Admin rejected payment
        const paymentId = data.split('_')[2];
        const paymentData = paymentConfirmations[paymentId];
        
        if (paymentData) {
            const { chatId } = paymentData;
            
            // Send rejection message to user
            bot.sendMessage(chatId, 'Sizning to\'lovingiz qabul qilinmadi. Iltimos, administrator bilan bog\'laning: @admin');
            
            // Notify admin group
            bot.sendMessage(ADMIN_GROUP_ID, `❌ To'lov rad etildi!\n\nFoydalanuvchi: ${paymentData.fullName}`);
            
            // Clean up
            delete paymentConfirmations[paymentId];
        }
        
        bot.answerCallbackQuery(query.id, { text: 'To\'lov rad etildi!' });
    }
});

// Handle contact sharing
bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    
    if (userStates[chatId] && userStates[chatId].step === 'awaiting_phone') {
        let phoneNumber = msg.contact.phone_number;
        if (phoneNumber.startsWith('+')) {
            phoneNumber = phoneNumber.substring(1);
        }
        
        // Check if this phone number is already registered
        await checkPhoneNumberAndProceed(
            chatId, 
            phoneNumber, 
            userStates[chatId].telegramId,
            userStates[chatId].firstName,
            userStates[chatId].lastName,
            userStates[chatId].username
        );
    }
});

// Handle photo messages (for payment screenshots)
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    
    if (userStates[chatId] && userStates[chatId].step === 'awaiting_screenshot') {
        const courseId = userStates[chatId].courseId;
        const course = courses[courseId];
        
        try {
            // Get user data using stored ID
            const userId = userIds[chatId];
            if (!userId) {
                bot.sendMessage(chatId, 'Foydalanuvchi ma\'lumotlari topilmadi. Iltimos, /start buyrug\'ini qayta yuboring.');
                return;
            }
            
            const response = await axios.get(`${API_URL}/users/${userId}`);
            const userData = response.data;
            
            if (!userData) {
                bot.sendMessage(chatId, 'Foydalanuvchi ma\'lumotlari topilmadi. Iltimos, /start buyrug\'ini qayta yuboring.');
                return;
            }
            
            // Get the largest photo (best quality)
            const photo = msg.photo[msg.photo.length - 1];
            const fileId = photo.file_id;
            
            // Generate unique payment ID
            const paymentId = Date.now().toString(36) + Math.random().toString(36).substring(2);
            
            // Store payment data for confirmation
            paymentConfirmations[paymentId] = {
                chatId: chatId,
                courseId: courseId,
                userId: userId, // Store the database user ID
                fullName: userData.full_name,
                phoneNumber: userData.phone_number,
                timestamp: new Date().toISOString()
            };
            
            // Send confirmation message to user
            bot.sendMessage(chatId, 'Rahmat! Sizning to\'lov chekingiz administratorga yuborildi. Tez orada tekshiriladi.');
            
            // Forward screenshot and details to admin group
            const adminMessage = `📝 Yangi to'lov!\n\n` +
                                `👤 Foydalanuvchi: ${userData.full_name}\n` +
                                `📞 Telefon: ${userData.phone_number}\n` +
                                `🆔 ID: ${userId}\n` +
                                `📚 Kurs: ${course.name}\n` +
                                `💰 Summa: ${course.display_price}\n` +
                                `🕒 Vaqt: ${new Date().toLocaleString()}`;
            
            // First send the screenshot
            await bot.sendPhoto(ADMIN_GROUP_ID, fileId);
            
            // Then send details with confirmation buttons
            bot.sendMessage(ADMIN_GROUP_ID, adminMessage, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {text: '✅ Tasdiqlash', callback_data: `confirm_payment_${paymentId}`},
                            {text: '❌ Bekor qilish', callback_data: `reject_payment_${paymentId}`}
                        ]
                    ]
                }
            });
            
            // Clear user state
            delete userStates[chatId];
            
        } catch (error) {
            console.error('Payment screenshot processing error:', error);
            bot.sendMessage(chatId, 'Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring yoki administrator bilan bog\'laning.');
        }
    }
});

// Handle all messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Skip if it's a contact message or photo (handled separately)
    if (msg.contact || msg.photo) return;
    
    // Handle phone number input as text
    if (userStates[chatId] && userStates[chatId].step === 'awaiting_phone' && text) {
        let phoneNumber = text.replace(/\D/g, '');
        
        // Validate phone number
        if (!phoneNumber || phoneNumber.length < 9) {
            bot.sendMessage(chatId, 'Iltimos, to\'g\'ri telefon raqam kiriting yoki "Telefon raqamni ulashish" tugmasini bosing.');
            return;
        }
        
        // Check if this phone number is already registered
        await checkPhoneNumberAndProceed(
            chatId, 
            phoneNumber, 
            userStates[chatId].telegramId,
            userStates[chatId].firstName,
            userStates[chatId].lastName,
            userStates[chatId].username
        );
        return;
    }
    
    // Handle name input for registration
    if (userStates[chatId] && userStates[chatId].step === 'registration_name' && text) {
        if (!text || text.length < 3) {
            bot.sendMessage(chatId, 'Iltimos, to\'liq ism va familiyangizni kiriting (kamida 3 ta belgi).');
            return;
        }
        
        try {
            // Create user and get the response with user ID
            const response = await axios.post(`${API_URL}/users`, {
                telegram_id: userStates[chatId].telegramId,
                chat_id: chatId,
                full_name: text,
                phone_number: userStates[chatId].phoneNumber,
                username: userStates[chatId].username,
                first_name: userStates[chatId].firstName,
                last_name: userStates[chatId].lastName,
                payment: 'unpaid',
                course: 0
            });
            
            // Store the user ID from the response
            if (response.data && response.data.id) {
                userIds[chatId] = response.data.id;
            }
            
            bot.sendMessage(chatId, `Rahmat, ${text}! Siz muvaffaqiyatli ro'yxatdan o'tdingiz.`);
            showMainMenu(chatId, text);
            delete userStates[chatId];
        } catch (error) {
            console.error('Registration error:', error);
            bot.sendMessage(chatId, 'Ro\'yxatdan o\'tishda xatolik yuz berdi. Iltimos, /start buyrug\'ini qayta yuboring.');
            delete userStates[chatId];
        }
        return;
    }
    
    // Handle menu options
    if (text) {
        switch(text) {
            case 'Kurs sotib olish':
                if (await isUserRegistered(chatId)) {
                    showTariffs(chatId);
                }
                break;
                
            case 'Mening ma\'lumotlarim':
                if (await isUserRegistered(chatId)) {
                    await showUserInfo(chatId);
                }
                break;
                
            case 'Orqaga':
                if (await isUserRegistered(chatId)) {
                    showMainMenu(chatId);
                }
                break;
                
            case 'FAQ':
                if (await isUserRegistered(chatId)) {
                    showFAQ(chatId);
                }
                break;
                
            case 'Akkauntni o\'chirish':
                if (await isUserRegistered(chatId)) {
                    confirmDeleteAccount(chatId);
                }
                break;
                
            case `${courses[1].name} - ${courses[1].display_price}`:
                if (await isUserRegistered(chatId)) {
                    sendCourseInfo(chatId, 1);
                }
                break;
                
            case `${courses[2].name} - ${courses[2].display_price}`:
                if (await isUserRegistered(chatId)) {
                    sendCourseInfo(chatId, 2);
                }
                break;
                
            case `${courses[3].name} - ${courses[3].display_price}`:
                if (await isUserRegistered(chatId)) {
                    sendCourseInfo(chatId, 3);
                }
                break;
                
            default:
                if (!userStates[chatId] && userPhoneNumbers[chatId]) {
                    showMainMenu(chatId);
                }
        }
    }
});

console.log('Bot ishga tushdi...');