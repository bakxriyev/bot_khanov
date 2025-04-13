import axios from 'axios';
import { courses } from './courses.js';
import { faq } from './faq.js';

// Main menu function
export function showMainMenu(bot, chatId, userName = '') {
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
}

// Show course tariffs
export function showTariffs(bot, chatId) {
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
}

// Show FAQ
export function showFAQ(bot, chatId) {
    const options = {
        reply_markup: {
            inline_keyboard: faq.map((item, index) => {
                return [{text: item.question, callback_data: `faq_${index}`}];
            }).concat([[{text: 'Orqaga', callback_data: 'back_to_main'}]])
        }
    };
    
    bot.sendMessage(chatId, 'Tez-tez beriladigan savollar:', options);
}

// Show user info
export async function showUserInfo(bot, chatId, userIds, API_URL, courses) {
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
}