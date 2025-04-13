import axios from 'axios';

// Delete account confirmation
export function confirmDeleteAccount(bot, chatId) {
    bot.sendMessage(chatId, 'Akkauntingizni o\'chirishni tasdiqlaysizmi?', {
        reply_markup: {
            inline_keyboard: [
                [{text: 'Ha', callback_data: 'confirm_delete_account'}],
                [{text: 'Yo\'q', callback_data: 'cancel_delete_account'}]
            ]
        }
    });
}

// Delete user account
export async function deleteUserAccount(bot, chatId, userIds, userPhoneNumbers, userStates, userReminders, API_URL) {
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
}