import axios from 'axios';

// Handle payment screenshot
export async function handlePaymentScreenshot(bot, msg, chatId, courseId, userIds, courses, userStates, paymentConfirmations, ADMIN_GROUP_ID, API_URL) {
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
        
        // Clear user state
        delete userStates[chatId];
        
    } catch (error) {
        console.error('Payment screenshot processing error:', error);
        bot.sendMessage(chatId, 'Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring yoki administrator bilan bog\'laning.');
    }
}

// Confirm payment
export async function confirmPayment(bot, paymentId, paymentConfirmations, userReminders, courses, ADMIN_GROUP_ID, API_URL) {
    const paymentData = paymentConfirmations[paymentId];
    
    if (!paymentData) {
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

// Reject payment
export async function rejectPayment(bot, paymentId, paymentConfirmations, ADMIN_GROUP_ID) {
    const paymentData = paymentConfirmations[paymentId];
    
    if (!paymentData) {
        return;
    }
    
    const { chatId } = paymentData;
    
    // Send rejection message to user
    bot.sendMessage(chatId, 'Sizning to\'lovingiz qabul qilinmadi. Iltimos, administrator bilan bog\'laning: @admin');
    
    // Notify admin group
    bot.sendMessage(ADMIN_GROUP_ID, `❌ To'lov rad etildi!\n\nFoydalanuvchi: ${paymentData.fullName}`);
    
    // Clean up
    delete paymentConfirmations[paymentId];
}