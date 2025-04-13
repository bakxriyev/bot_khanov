import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Import modules
import { loadUserData, saveUserData } from './modules/data-strotage.js';
import { courses } from './modules/courses.js';
import { faq } from './modules/faq.js';
import { generatePaymeLink } from './modules/payment-utils.js';

// Bot token and API URL
const token = process.env.TELEGRAM_BOT_TOKEN || '7898538816:AAGsvkzD5vfBy1289lvq3w_7b9HuuHd2RWw';
const ADMIN_GROUP_ID = process.env.ADMIN_GROUP_ID || '-4631952717';
const API_URL = process.env.API_URL || 'https://backend.khanovbekzod.uz';

// Create bot instance
const bot = new TelegramBot(token, {polling: true});

// Load user data from storage
let userData = loadUserData();
let userPhoneNumbers = userData.userPhoneNumbers || {};
let userStates = userData.userStates || {};
let userReminders = userData.userReminders || {};
let paymentConfirmations = userData.paymentConfirmations || {};
let userIds = userData.userIds || {};

// Save user data periodically (every 5 minutes)
setInterval(() => {
    saveUserData({
        userPhoneNumbers,
        userStates,
        userReminders,
        paymentConfirmations,
        userIds
    });
    console.log('User data saved automatically');
}, 300000);

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
const sendCourseInfo = async (chatId, courseId) => {
    const course = courses[courseId];
    
    try {
        // Get user data to include in payment link
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
        
        // Generate dynamic payment link with user's full name
        const paymentLink = generatePaymeLink(
            userData.full_name,
            course.name,
            course.price
        );
        
        const message = `💰 ${course.name} – ${course.display_price}\n\n${course.description}\n\nKursni sotib olish uchun "To'lov qilish" tugmasini bosing.`;
        
        const options = {
            caption: message,
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Payme orqali to\'lov qilish', url: paymentLink}],
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
                        [{text: 'Payme orqali to\'lov qilish', url: paymentLink}],
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
        
        // Save updated user data
        saveUserData({
            userPhoneNumbers,
            userStates,
            userReminders,
            paymentConfirmations,
            userIds
        });
        
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
    } catch (error) {
        console.error('Error generating payment link:', error);
        bot.sendMessage(chatId, 'Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.');
    }
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
        
        // Save updated user data
        saveUserData({
            userPhoneNumbers,
            userStates,
            userReminders,
            paymentConfirmations,
            userIds
        });
        
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
    // First check if we have the user ID in memory
    if (!userIds[chatId]) {
        console.log(`User ID not found in memory for chat ID: ${chatId}`);
        
        // Try to find user by chat_id in the database
        try {
            const response = await axios.get(`${API_URL}/users?chat_id=${chatId}`);
            const users = response.data;
            
            if (users && users.length > 0) {
                // Found user, update local storage
                userIds[chatId] = users[0].id;
                userPhoneNumbers[chatId] = users[0].phone_number;
                
                // Save updated user data
                saveUserData({
                    userPhoneNumbers,
                    userStates,
                    userReminders,
                    paymentConfirmations,
                    userIds
                });
                
                console.log(`Found user in database, ID: ${users[0].id}`);
                return true;
            } else {
                console.log(`User not found in database for chat ID: ${chatId}`);
                bot.sendMessage(chatId, 'Iltimos, avval ro\'yxatdan o\'ting. /start buyrug\'ini yuboring.');
                return false;
            }
        } catch (error) {
            console.error('Error checking user registration:', error);
            bot.sendMessage(chatId, 'Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring /start buyrug\'ini yuborib.');
            return false;
        }
    }
    
    // We have the user ID in memory, verify it exists in the database
    try {
        const response = await axios.get(`${API_URL}/users/${userIds[chatId]}`);
        const userData = response.data;
        
        if (!userData) {
            console.log(`User not found in database with ID: ${userIds[chatId]}`);
            bot.sendMessage(chatId, 'Sizning maʼlumotlaringiz topilmadi. Iltimos, /start buyrugʻini yuboring.');
            
            // Clear invalid user ID
            delete userIds[chatId];
            saveUserData({
                userPhoneNumbers,
                userStates,
                userReminders,
                paymentConfirmations,
                userIds
            });
            
            return false;
        }
        
        console.log(`User verified in database, ID: ${userIds[chatId]}`);
        return true;
    } catch (error) {
        console.error('User check error:', error);
        bot.sendMessage(chatId, 'Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring /start buyrug\'ini yuborib.');
        return false;
    }
};

// Find user by phone number
const findUserByPhoneNumber = async (phoneNumber) => {
    try {
        const response = await axios.get(`${API_URL}/users`);
        const allUsers = response.data;
        
        // Find user with matching phone number
        const user = allUsers.find(user => user.phone_number === phoneNumber);
        console.log(`Searching for user with phone: ${phoneNumber}, Found:`, user ? 'Yes' : 'No');
        return user;
    } catch (error) {
        console.error('Error fetching users:', error);
        return null;
    }
};

// Check if phone number is registered and handle accordingly
const checkPhoneNumberAndProceed = async (chatId, phoneNumber, telegramId, firstName, lastName, username) => {
    try {
        // Find user with this phone number
        const existingUser = await findUserByPhoneNumber(phoneNumber);
        
        if (existingUser) {
            // User already registered with this phone number
            userIds[chatId] = existingUser.id;
            userPhoneNumbers[chatId] = phoneNumber;
            
            // Update chat_id if it's different (user might be using a different device)
            if (existingUser.chat_id !== chatId) {
                await axios.get(`${API_URL}/users/${existingUser.id}`, {
                    chat_id: chatId
                });
                console.log(`Updated chat_id for user ${existingUser.id} to ${chatId}`);
            }
            
            bot.sendMessage(chatId, `Xush kelibsiz, ${existingUser.full_name}! Siz allaqachon ro'yxatdan o'tgansiz.`);
            showMainMenu(chatId, existingUser.full_name);
            
            // Clear user state
            delete userStates[chatId];
            
            // Save updated user data
            saveUserData({
                userPhoneNumbers,
                userStates,
                userReminders,
                paymentConfirmations,
                userIds
            });
            
            console.log(`Existing user logged in: ${existingUser.id}, ${existingUser.full_name}`);
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
            
            // Save updated user data
            saveUserData({
                userPhoneNumbers,
                userStates,
                userReminders,
                paymentConfirmations,
                userIds
            });
            
            console.log(`New user registration started with phone: ${phoneNumber}`);
        }
    } catch (error) {
        console.error('Phone number check error:', error);
        bot.sendMessage(chatId, 'Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.');
    }
};

// Handle payment screenshot
const handlePaymentScreenshot = async (msg, chatId, courseId) => {
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
        
        // Save updated user data
        saveUserData({
            userPhoneNumbers,
            userStates,
            userReminders,
            paymentConfirmations,
            userIds
        });
        
        // Send confirmation message to user
        bot.sendMessage(chatId, 'Rahmat! Sizning to\'lov chekingiz administratorga yuborildi. Tez orada tekshiriladi.');
        
        const course = courses[courseId];
        
        // Create admin message with all details
        const adminMessage = `📝 Yangi to'lov!\n\n` +
                            `👤 Foydalanuvchi: ${userData.full_name}\n` +
                            `📞 Telefon: ${userData.phone_number}\n` +
                            `🆔 ID: ${userId}\n` +
                            `📚 Kurs: ${course.name}\n` +
                            `💰 Summa: ${course.display_price}\n` +
                            `🕒 Vaqt: ${new Date().toLocaleString()}`;
        
        // Send photo with caption and buttons to admin group
        bot.sendPhoto(ADMIN_GROUP_ID, fileId, {
            caption: adminMessage,
            reply_markup: {
                inline_keyboard: [
                    [
                        {text: '✅ Tasdiqlash', callback_data: `confirm_payment_${paymentId}`},
                        {text: '❌ Bekor qilish', callback_data: `reject_payment_${paymentId}`}
                    ]
                ]
            }
        });
        
        console.log(`Payment screenshot received from user ${userId} for course ${courseId}`);
        
        // Clear user state
        delete userStates[chatId];
        
    } catch (error) {
        console.error('Payment screenshot processing error:', error);
        bot.sendMessage(chatId, 'Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring yoki administrator bilan bog\'laning.');
    }
};

// Confirm payment
const confirmPayment = async (paymentId) => {
    const paymentData = paymentConfirmations[paymentId];
    
    if (!paymentData) {
        console.log(`Payment data not found for ID: ${paymentId}`);
        return;
    }
    
    const { chatId, courseId, userId } = paymentData;
    
    // Mark as paid in database using user ID
    try {
        await axios.post(`${API_URL}/users/payment/${userId}`, {
            payment: 'paid',
            course: courseId
        });
        
        // Mark as paid in memory
        if (userReminders[chatId]) {
            userReminders[chatId].paid = true;
        }
        
        // Save updated user data
        saveUserData({
            userPhoneNumbers,
            userStates,
            userReminders,
            paymentConfirmations,
            userIds
        });
        
        // Send success message to user
        const course = courses[courseId];
        bot.sendMessage(chatId, `Tabriklaymiz! Sizning to'lovingiz muvaffaqiyatli qabul qilindi.\n\nSiz "${course.name}" kursini sotib oldingiz.\n\nKursga kirish uchun havola: ${course.telegramLink}`);
        
        // Notify admin group
        bot.sendMessage(ADMIN_GROUP_ID, `✅ To'lov tasdiqlandi!\n\nFoydalanuvchi: ${paymentData.fullName}\nKurs: ${course.name}\nSumma: ${course.display_price}`);
        
        console.log(`Payment confirmed for user ${userId}, course ${courseId}`);
    } catch (error) {
        console.error('Payment confirmation error:', error);
        bot.sendMessage(ADMIN_GROUP_ID, `❌ To'lovni tasdiqlashda xatolik yuz berdi: ${error.message}`);
    }
    
    // Clean up
    delete paymentConfirmations[paymentId];
    
    // Save updated user data
    saveUserData({
        userPhoneNumbers,
        userStates,
        userReminders,
        paymentConfirmations,
        userIds
    });
};

// Reject payment
const rejectPayment = async (paymentId) => {
    const paymentData = paymentConfirmations[paymentId];
    
    if (!paymentData) {
        console.log(`Payment data not found for ID: ${paymentId}`);
        return;
    }
    
    const { chatId } = paymentData;
    
    // Send rejection message to user
    bot.sendMessage(chatId, 'Sizning to\'lovingiz qabul qilinmadi. Iltimos, administrator bilan bog\'laning: @admin');
    
    // Notify admin group
    bot.sendMessage(ADMIN_GROUP_ID, `❌ To'lov rad etildi!\n\nFoydalanuvchi: ${paymentData.fullName}`);
    
    console.log(`Payment rejected for user ${paymentData.userId}`);
    
    // Clean up
    delete paymentConfirmations[paymentId];
    
    // Save updated user data
    saveUserData({
        userPhoneNumbers,
        userStates,
        userReminders,
        paymentConfirmations,
        userIds
    });
};

// Handle /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const username = msg.from.username || '';
    
    console.log(`/start command received from chat ID: ${chatId}`);
    
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
    
    // Save updated user data
    saveUserData({
        userPhoneNumbers,
        userStates,
        userReminders,
        paymentConfirmations,
        userIds
    });
});

// Handle callback queries (for FAQ and other inline buttons)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    console.log(`Callback query received: ${data}`);
    
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
        
        saveUserData({
            userPhoneNumbers,
            userStates,
            userReminders,
            paymentConfirmations,
            userIds
        });
        
        bot.sendMessage(chatId, 'Iltimos, to\'lov chekining screenshotini yuboring:');
        bot.answerCallbackQuery(query.id);
    } else if (data.startsWith('confirm_payment_')) {
        await confirmPayment(data.split('_')[2]);
        bot.answerCallbackQuery(query.id, { text: 'To\'lov tasdiqlandi!' });
    } else if (data.startsWith('reject_payment_')) {
        await rejectPayment(data.split('_')[2]);
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
        
        console.log(`Contact received from chat ID: ${chatId}, phone: ${phoneNumber}`);
        
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
        console.log(`Payment screenshot received from chat ID: ${chatId}`);
        await handlePaymentScreenshot(msg, chatId, userStates[chatId].courseId);
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
        
        console.log(`Phone number received as text from chat ID: ${chatId}, phone: ${phoneNumber}`);
        
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
            console.log(`Name received for registration from chat ID: ${chatId}, name: ${text}`);
            
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
                console.log(`New user registered with ID: ${response.data.id}`);
            }
            
            bot.sendMessage(chatId, `Rahmat, ${text}! Siz muvaffaqiyatli ro'yxatdan o'tdingiz.`);
            showMainMenu(chatId, text);
            delete userStates[chatId];
            
            saveUserData({
                userPhoneNumbers,
                userStates,
                userReminders,
                paymentConfirmations,
                userIds
            });
        } catch (error) {
            console.error('Registration error:', error);
            bot.sendMessage(chatId, 'Ro\'yxatdan o\'tishda xatolik yuz berdi. Iltimos, /start buyrug\'ini qayta yuboring.');
            delete userStates[chatId];
            
            saveUserData({
                userPhoneNumbers,
                userStates,
                userReminders,
                paymentConfirmations,
                userIds
            });
        }
        return;
    }
    
    // Handle menu options
    if (text) {
        switch(text) {
            case 'Kurs sotib olish':
                const registered = await isUserRegistered(chatId);
                if (registered) {
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
                    await sendCourseInfo(chatId, 1);
                }
                break;
                
            case `${courses[2].name} - ${courses[2].display_price}`:
                if (await isUserRegistered(chatId)) {
                    await sendCourseInfo(chatId, 2);
                }
                break;
                
            case `${courses[3].name} - ${courses[3].display_price}`:
                if (await isUserRegistered(chatId)) {
                    await sendCourseInfo(chatId, 3);
                }
                break;
                
            default:
                if (!userStates[chatId] && userPhoneNumbers[chatId]) {
                    showMainMenu(chatId);
                }
        }
    }
});

// Log errors
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

console.log('Bot ishga tushdi...');

// Handle process termination
process.on('SIGINT', () => {
    console.log('Saving user data before exit...');
    saveUserData({
        userPhoneNumbers,
        userStates,
        userReminders,
        paymentConfirmations,
        userIds
    });
    process.exit();
});