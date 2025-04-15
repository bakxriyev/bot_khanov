import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Import modules
import { loadUserData, saveUserData } from "./modules/data-strotage.js"
import { courses } from './modules/courses.js'
import { faq } from './modules/faq.js';
import { showMainMenu, showTariffs, showFAQ, showUserInfo } from './modules/menu.js'
import { handlePaymentScreenshot, confirmPayment, rejectPayment } from './modules/payment.js'
import { confirmDeleteAccount, deleteUserAccount } from './modules/account.js'

// Bot token and API URL
const token = process.env.TELEGRAM_BOT_TOKEN || '7898538816:AAGsvkzD5vfBy1289lvq3w_7b9HuuHd2RWw';
const ADMIN_GROUP_ID = process.env.ADMIN_GROUP_ID || '-4631952717';
const API_URL = process.env.API_URL || 'https://backend.khanovbekzod.uz';

// Create bot instance
const bot = new TelegramBot(token, {polling: true});

// Load user data from storage
const userData = loadUserData();
const userPhoneNumbers = userData.userPhoneNumbers || {};
const userStates = userData.userStates || {};
const userReminders = userData.userReminders || {};
const paymentConfirmations = userData.paymentConfirmations || {};
const userIds = userData.userIds || {};

// Save user data periodically (every 5 minutes)
setInterval(() => {
    saveUserData({
        userPhoneNumbers,
        userStates,
        userReminders,
        paymentConfirmations,
        userIds
    });
}, 300000);

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

// Find user by phone number
const findUserByPhoneNumber = async (phoneNumber) => {
    try {
        const response = await axios.get(`${API_URL}/users`);
        const allUsers = response.data;
        
        // Find user with matching phone number
        return allUsers.find(user => user.phone_number === phoneNumber);
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
            }
            
            bot.sendMessage(chatId, `Xush kelibsiz, ${existingUser.full_name}! Siz allaqachon ro'yxatdan o'tgansiz.`);
            showMainMenu(bot, chatId, existingUser.full_name);
            
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
        }
    } catch (error) {
        console.error('Phone number check error:', error);
        bot.sendMessage(chatId, 'Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.');
    }
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
    
    if (data.startsWith('faq_')) {
        const index = parseInt(data.split('_')[1]);
        bot.sendMessage(chatId, faq[index].answer);
        bot.answerCallbackQuery(query.id);
    } else if (data === 'back_to_main') {
        const registered = await isUserRegistered(chatId);
        if (registered) {
            showMainMenu(bot, chatId);
        }
        bot.answerCallbackQuery(query.id);
    } else if (data === 'confirm_delete_account') {
        await deleteUserAccount(bot, chatId, userIds, userPhoneNumbers, userStates, userReminders, API_URL);
        saveUserData({
            userPhoneNumbers,
            userStates,
            userReminders,
            paymentConfirmations,
            userIds
        });
        bot.answerCallbackQuery(query.id);
    } else if (data === 'cancel_delete_account') {
        bot.sendMessage(chatId, 'Akkauntni o\'chirish bekor qilindi.');
        showMainMenu(bot, chatId);
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
        await confirmPayment(
            bot, 
            data.split('_')[2], 
            paymentConfirmations, 
            userReminders, 
            courses, 
            ADMIN_GROUP_ID, 
            API_URL
        );
        
        saveUserData({
            userPhoneNumbers,
            userStates,
            userReminders,
            paymentConfirmations,
            userIds
        });
        
        bot.answerCallbackQuery(query.id, { text: 'To\'lov tasdiqlandi!' });
    } else if (data.startsWith('reject_payment_')) {
        await rejectPayment(
            bot, 
            data.split('_')[2], 
            paymentConfirmations, 
            ADMIN_GROUP_ID
        );
        
        saveUserData({
            userPhoneNumbers,
            userStates,
            userReminders,
            paymentConfirmations,
            userIds
        });
        
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
        await handlePaymentScreenshot(
            bot, 
            msg, 
            chatId, 
            userStates[chatId].courseId, 
            userIds, 
            courses, 
            userStates, 
            paymentConfirmations, 
            ADMIN_GROUP_ID, 
            API_URL
        );
        
        saveUserData({
            userPhoneNumbers,
            userStates,
            userReminders,
            paymentConfirmations,
            userIds
        });
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
                full_name: text,
                phone_number: userStates[chatId].phoneNumber,
                payment: 'unpaid',
                course: 0
            });
            
            // Store the user ID from the response
            if (response.data && response.data.id) {
                userIds[chatId] = response.data.id;
            }
            
            bot.sendMessage(chatId, `Rahmat, ${text}! Siz muvaffaqiyatli ro'yxatdan o'tdingiz.`);
            showMainMenu(bot, chatId, text);
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
                if (await isUserRegistered(chatId)) {
                    showTariffs(bot, chatId);
                }
                break;
                
            case 'Mening ma\'lumotlarim':
                if (await isUserRegistered(chatId)) {
                    await showUserInfo(bot, chatId, userIds, API_URL, courses);
                }
                break;
                
            case 'Orqaga':
                if (await isUserRegistered(chatId)) {
                    showMainMenu(bot, chatId);
                }
                break;
                
            case 'FAQ':
                if (await isUserRegistered(chatId)) {
                    showFAQ(bot, chatId);
                }
                break;
                
            case 'Akkauntni o\'chirish':
                if (await isUserRegistered(chatId)) {
                    confirmDeleteAccount(bot, chatId);
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
                    showMainMenu(bot, chatId);
                }
        }
    }
});

console.log('Bot ishga tushdi...');