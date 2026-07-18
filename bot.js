import dotenv from 'dotenv';
dotenv.config();

import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ADMIN_GROUP_ID = process.env.ADMIN_GROUP_ID || '-4631952717';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const bot = new TelegramBot(TOKEN, { polling: true });

const COURSE_FILE = path.join(__dirname, 'course-data.json');
let courses = loadCourses();
const adminSessions = {};
const userStates = {};

function loadCourses() {
  try {
    if (fs.existsSync(COURSE_FILE)) {
      return JSON.parse(fs.readFileSync(COURSE_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading courses:', e);
  }
  return {
    course_1: {
      name: 'Birinchi qadam',
      price: '699000',
      display_price: '699 000 UZS',
      description: '📌 Savdo sohasiga kirish\n\n• Mijoz psixologiyasi\n• Asosiy muloqot ko\'nikmalari\n• Savdo terminologiyasi\n\n📚 Modullar soni: 4 ta\n🎥 16+ ta video dars\n🔒 Yopiq telegram guruhga kirish',
      groupLink: '',
      paymentLink: ''
    },
    course_2: {
      name: 'Ishga tayyor',
      price: '899000',
      display_price: '899 000 UZS',
      description: '📌 Savdo sohasida to\'liq tayyorgarlik\n\n• Birinchi qadam modullari\n• Real sotuv amaliyoti\n• Mijozlar bilan ishlash strategiyalari\n• Shaxsiy mentorlik\n\n📚 Modullar soni: 8 ta\n🎥 30+ ta video dars\n🔒 Yopiq telegram guruhga kirish',
      groupLink: '',
      paymentLink: ''
    },
    course_3: {
      name: 'Mutaxassis (Pro tarifi)',
      price: '1399000',
      display_price: '1 399 000 UZS',
      description: '📌 To\'liq professional savdo mutaxassisi\n\n• Barcha modullar\n• Individual coaching\n• Real loyihalar\n• Sertifikat\n• Ish bilan ta\'minlash ko\'magi\n\n📚 Modullar soni: 12 ta\n🎥 50+ ta video dars\n🔒 Yopiq telegram guruhga kirish',
      groupLink: '',
      paymentLink: ''
    }
  };
}

function saveCourses() {
  try {
    fs.writeFileSync(COURSE_FILE, JSON.stringify(courses, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving courses:', e);
  }
}

async function findOrCreateUser(chatId) {
  const { data, error } = await supabase
    .from('khanov')
    .select('*')
    .eq('chat_id', String(chatId))
    .single();

  if (data) return data;
  if (error && error.code !== 'PGRST116') {
    console.error('Error finding user:', error);
  }

  const { data: newUser, error: createError } = await supabase
    .from('khanov')
    .insert([{ chat_id: String(chatId) }])
    .select()
    .single();

  if (createError) {
    console.error('Error creating user:', createError);
    return null;
  }
  return newUser;
}

async function updateUser(chatId, updates) {
  const { data, error } = await supabase
    .from('khanov')
    .update(updates)
    .eq('chat_id', String(chatId))
    .select()
    .single();

  if (error) console.error('Error updating user:', error);
  return data;
}

async function getAllUsers() {
  const { data, error } = await supabase
    .from('khanov')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }
  return data || [];
}

function generatePaymeLink(fullName, courseName, price) {
  const paymentData = `m=67efddd7ed17d6583aa3720d;ac.full_name=${encodeURIComponent(fullName)};ac.course=${encodeURIComponent(courseName)};a=${price}`;
  return `http://checkout.paycom.uz/${Buffer.from(paymentData).toString('base64')}`;
}

function mainMenuKeyboard() {
  return {
    reply_markup: {
      keyboard: [['📚 Kurs haqida', '❓ FAQ'], ['🛒 Kursni sotib olish'], ['👤 Mening ma\'lumotlarim']],
      resize_keyboard: true
    }
  };
}

function phoneKeyboard() {
  return {
    reply_markup: {
      keyboard: [[{ text: '📱 Telefon raqamini yuborish', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  };
}

function rmKeyboard() {
  return { reply_markup: { remove_keyboard: true } };
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  delete adminSessions[chatId];
  delete userStates[chatId];

  const user = await findOrCreateUser(chatId);
  const name = (user && user.full_name) || msg.from.first_name || 'foydalanuvchi';

  await bot.sendMessage(chatId, `👋 Assalomu alaykum, ${name}!\n\nBotimizga xush kelibsiz! Bo'limlardan birini tanlang:`, mainMenuKeyboard());
});

bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id;
  if (adminSessions[chatId]) return showAdminPanel(chatId);

  await bot.sendMessage(chatId, '🔐 Admin panelga kirish uchun parolni kiriting:');
  userStates[chatId] = { step: 'awaiting_admin_password' };
});

bot.on('contact', async (msg) => {
  const chatId = msg.chat.id;
  const state = userStates[chatId];
  if (!state || state.step !== 'awaiting_phone') return;

  state.tempPhone = msg.contact.phone_number;
  state.step = 'awaiting_name';

  await bot.sendMessage(chatId, '📝 Ism va familiyangizni kiriting:', rmKeyboard());
});

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const state = userStates[chatId];
  if (!state || state.step !== 'awaiting_payment') return;

  const photo = msg.photo[msg.photo.length - 1];
  const course = courses[state.selectedCourse];
  if (!course) {
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi. /start ni bosing.');
    delete userStates[chatId];
    return;
  }

  const { data: user } = await supabase
    .from('khanov')
    .select('*')
    .eq('chat_id', String(chatId))
    .single();

  if (!user) {
    await bot.sendMessage(chatId, '❌ Foydalanuvchi topilmadi. /start ni bosing.');
    delete userStates[chatId];
    return;
  }

  const now = new Date();
  const timeStr = now.toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });

  const caption = `📝 Yangi to'lov!

👤 Foydalanuvchi: ${user.full_name || msg.from.first_name || 'Noma\'lum'}
📞 Telefon: ${user.phone_number || state.tempPhone || 'Noma\'lum'}
🆔 ID: ${user.id}
📚 Kurs: ${course.name}
💰 Summa: ${course.display_price}
🕒 Vaqt: ${timeStr}`;

  try {
    await bot.sendPhoto(ADMIN_GROUP_ID, photo.file_id, {
      caption,
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Tasdiqlash', callback_data: `confirm_pay|${user.id}|${state.selectedCourse}` },
          { text: '❌ Bekor qilish', callback_data: `reject_pay|${user.id}` }
        ]]
      }
    });
    await bot.sendMessage(chatId, '✅ To\'lov ma\'lumotlaringiz adminga yuborildi! Tez orada tasdiqlanadi.', rmKeyboard());
  } catch (e) {
    console.error('Error sending to admin group:', e);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi. Iltimos qaytadan urinib ko\'ring.');
  }

  delete userStates[chatId];
});

bot.on('message', async (msg) => {
  if (!msg.text) return;
  if (msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const state = userStates[chatId];

  if (state && state.step === 'awaiting_admin_password') {
    if (text === ADMIN_PASSWORD) {
      adminSessions[chatId] = true;
      delete userStates[chatId];
      return showAdminPanel(chatId);
    }
    await bot.sendMessage(chatId, '❌ Noto\'g\'ri parol! Qaytadan urinib ko\'ring yoki /start ni bosing.');
    delete userStates[chatId];
    return;
  }

  if (state && state.step === 'awaiting_name') {
    if (text.length < 2) {
      await bot.sendMessage(chatId, '❌ Ism familiya kamida 2 ta harfdan iborat bo\'lishi kerak. Qaytadan kiriting:');
      return;
    }

    const course = courses[state.selectedCourse];
    await updateUser(chatId, {
      full_name: text,
      phone_number: state.tempPhone,
      payed_cource: course ? course.name : null
    });

    let paymentLink = course.paymentLink;
    if (!paymentLink) {
      paymentLink = generatePaymeLink(text, course.name, course.price);
    }

    await bot.sendMessage(chatId,
      `✅ Ro'yxatdan o'tdingiz!\n\n📚 Kurs: ${course.name}\n💰 Narx: ${course.display_price}\n\n💳 To'lov qilish uchun havola:\n${paymentLink}\n\n📸 To'lovni amalga oshirgandan so'ng, chek/skrinshotni botga yuboring.`,
      rmKeyboard()
    );
    state.step = 'awaiting_payment';
    return;
  }

  if (state && state.step === 'awaiting_broadcast') {
    delete userStates[chatId];
    const users = await getAllUsers();
    let sent = 0;
    let failed = 0;

    await bot.sendMessage(chatId, `📤 Xabar yuborilmoqda... (${users.length} ta foydalanuvchi)`);

    for (const user of users) {
      if (!user.chat_id) continue;
      try {
        await bot.sendMessage(Number(user.chat_id), text);
        sent++;
      } catch (e) {
        failed++;
      }
      await new Promise(r => setTimeout(r, 50));
    }

    await bot.sendMessage(chatId, `✅ Xabar yuborildi!\n\n• Yuborildi: ${sent}\n• Xatolik: ${failed}\n• Jami: ${users.length}`);
    return;
  }

  if (state && state.step === 'awaiting_course_edit') {
    const { editCourseId, editField, editFieldName } = state;
    const course = courses[editCourseId];
    if (!course) {
      await bot.sendMessage(chatId, '❌ Kurs topilmadi.');
      delete userStates[chatId];
      return;
    }

    course[editField] = text;
    courses[editCourseId] = course;
    saveCourses();

    await bot.sendMessage(chatId, `✅ ${editFieldName} o'zgartirildi!\n\nYangi qiymat: ${text}`);
    delete userStates[chatId];
    return adminEditCourse(chatId, editCourseId);
  }

  if (adminSessions[chatId]) {
    return showAdminPanel(chatId);
  }

  if (text === '📚 Kurs haqida') return showCourseInfo(chatId);
  if (text === '❓ FAQ') return showFAQ(chatId);
  if (text === '🛒 Kursni sotib olish') return showCourseSelection(chatId);
  if (text === '👤 Mening ma\'lumotlarim') return showMyInfo(chatId);

  await bot.sendMessage(chatId, 'Iltimos, menyudan birini tanlang:', mainMenuKeyboard());
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const msgId = query.message.message_id;

  try {
    await bot.answerCallbackQuery(query.id);

    if (data.startsWith('select_course|')) {
      const courseId = data.split('|')[1];
      const course = courses[courseId];
      if (!course) return bot.sendMessage(chatId, '❌ Kurs topilmadi.');

      userStates[chatId] = { step: 'awaiting_phone', selectedCourse: courseId };

      await bot.sendMessage(chatId,
        `📚 <b>${course.name}</b>\n\n${course.description}\n\n💰 <b>Narx:</b> ${course.display_price}\n\nRo'yxatdan o'tish uchun telefon raqamingizni yuboring:`,
        { parse_mode: 'HTML', ...phoneKeyboard() }
      );
      return;
    }

    if (data.startsWith('confirm_pay|')) {
      const parts = data.split('|');
      const userId = parts[1];
      const courseId = parts[2];

      const { data: user } = await supabase
        .from('khanov')
        .update({ is_payed: true })
        .eq('id', userId)
        .select()
        .single();

      if (!user) {
        await bot.editMessageCaption('❌ Xatolik: foydalanuvchi topilmadi', { chat_id: ADMIN_GROUP_ID, message_id: msgId });
        return;
      }

      const course = courses[courseId];
      const groupLink = course ? course.groupLink : '';

      if (user.chat_id) {
        let message = '✅ <b>To\'lovingiz tasdiqlandi!</b> 🎉\n\n';
        if (groupLink) message += `🔗 <b>Yopiq Telegram guruhingiz:</b>\n${groupLink}\n\n`;
        message += 'Kursni muvaffaqiyatli boshlashingiz mumkin! Omad tilaymiz! 🚀';
        try {
          await bot.sendMessage(Number(user.chat_id), message, { parse_mode: 'HTML' });
        } catch (e) {
          console.error('Error sending confirmation to user:', e);
        }
      }

      await bot.editMessageCaption(
        `✅ <b>To'lov tasdiqlandi!</b>\n\n👤 ${user.full_name || 'Noma\'lum'}\n📚 ${course ? course.name : 'Noma\'lum'}`,
        { chat_id: ADMIN_GROUP_ID, message_id: msgId, parse_mode: 'HTML' }
      );
      return;
    }

    if (data.startsWith('reject_pay|')) {
      const userId = data.split('|')[1];

      const { data: user } = await supabase
        .from('khanov')
        .select('*')
        .eq('id', userId)
        .single();

      if (user && user.chat_id) {
        try {
          await bot.sendMessage(Number(user.chat_id),
            '❌ <b>To\'lovingiz tasdiqlanmadi.</b>\n\nIltimos, biz bilan bog\'laning: @khanov_work\n\nTo\'lov ma\'lumotlarini tekshirib qaytadan urinib ko\'ring.',
            { parse_mode: 'HTML' }
          );
        } catch (e) {
          console.error('Error sending rejection to user:', e);
        }
      }

      await bot.editMessageCaption(
        `❌ <b>To'lov bekor qilindi</b>\n\n👤 ${user ? user.full_name || 'Noma\'lum' : 'Noma\'lum'}`,
        { chat_id: ADMIN_GROUP_ID, message_id: msgId, parse_mode: 'HTML' }
      );
      return;
    }

    const adminActions = {
      admin_courses: adminListCourses,
      admin_broadcast: async (id) => {
        userStates[id] = { step: 'awaiting_broadcast' };
        await bot.sendMessage(id, '📢 Yubormoqchi bo\'lgan xabaringizni kiriting:');
      },
      admin_users: adminShowUsers,
      admin_stats: adminShowStats,
      admin_logout: async (id) => {
        delete adminSessions[id];
        delete userStates[id];
        await bot.sendMessage(id, '🚪 Admin paneldan chiqdingiz.', rmKeyboard());
      },
      admin_back: showAdminPanel
    };

    if (adminActions[data]) return adminActions[data](chatId);

    if (data.startsWith('edit_course|')) {
      const courseId = data.split('|')[1];
      return adminEditCourse(chatId, courseId);
    }

    if (data.startsWith('edit_field|')) {
      const parts = data.split('|');
      const courseId = parts[1];
      const field = parts[2];

      const fieldNames = {
        name: 'Kurs nomi',
        display_price: 'Narx',
        price: 'Payme narxi (son)',
        description: 'Tavsif',
        groupLink: 'Guruh havolasi',
        paymentLink: 'To\'lov havolasi'
      };

      userStates[chatId] = {
        step: 'awaiting_course_edit',
        editCourseId: courseId,
        editField: field,
        editFieldName: fieldNames[field] || field
      };

      await bot.sendMessage(chatId,
        `✏️ ${fieldNames[field] || field} uchun yangi qiymatni kiriting:\n\nHozirgi: ${courses[courseId][field] || 'Mavjud emas'}`);
      return;
    }

  } catch (e) {
    console.error('Callback error:', e);
  }
});

async function showCourseInfo(chatId) {
  let text = '📚 <b>Kurslar haqida</b>\n\n';
  let idx = 1;
  for (const course of Object.values(courses)) {
    text += `<b>${idx}. ${course.name}</b>\n💰 ${course.display_price}\n${course.description}\n\n`;
    idx++;
  }
  text += 'Batafsil ma\'lumot va sotib olish uchun "Kursni sotib olish" bo\'limiga o\'ting.';
  await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

async function showFAQ(chatId) {
  const faq = [
    { q: 'Kurs qancha vaqt davom etadi?', a: 'Kurs davomiyligi tanlagan tarifingizga bog\'liq. Batafsil ma\'lumotni "Kurs haqida" bo\'limida olishingiz mumkin.' },
    { q: 'Kursni tugatganimdan keyin sertifikat beriladimi?', a: 'Ha, "Mutaxassis (Pro tarifi)" kursini muvaffaqiyatli tugatganlarga sertifikat beriladi.' },
    { q: 'To\'lov qanday amalga oshiriladi?', a: 'To\'lov Payme orqali amalga oshiriladi. To\'lov qilganingizdan so\'ng chekni botga yuboring.' },
    { q: 'Kursni qaytarib olish mumkinmi?', a: 'Kurs to\'liq to\'langandan so\'ng, agar mos kelmasa, admin bilan bog\'lanishingiz mumkin.' }
  ];

  let text = '❓ <b>Tez-tez so\'raladigan savollar</b>\n\n';
  faq.forEach((item, i) => {
    text += `<b>${i + 1}. ${item.q}</b>\n${item.a}\n\n`;
  });
  await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

async function showCourseSelection(chatId) {
  const buttons = Object.entries(courses).map(([id, course]) => [
    { text: `${course.name} - ${course.display_price}`, callback_data: `select_course|${id}` }
  ]);

  await bot.sendMessage(chatId, '🛒 <b>Kursni tanlang:</b>', {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons }
  });
}

async function showMyInfo(chatId) {
  const { data: user } = await supabase
    .from('khanov')
    .select('*')
    .eq('chat_id', String(chatId))
    .single();

  if (!user) {
    return bot.sendMessage(chatId, '❌ Ma\'lumot topilmadi. /start ni bosing.');
  }

  let text = '👤 <b>Mening ma\'lumotlarim</b>\n\n';
  text += `🆔 ID: ${user.id}\n`;
  text += `👤 Ism: ${user.full_name || 'To\'ldirilmagan'}\n`;
  text += `📞 Telefon: ${user.phone_number || 'To\'ldirilmagan'}\n`;
  text += `📚 Kurs: ${user.payed_cource || 'Tanlanmagan'}\n`;
  text += `✅ To\'lov: ${user.is_payed ? 'To\'langan ✅' : 'To\'lanmagan ❌'}\n`;
  text += `📅 Ro\'yxatdan o\'tgan: ${new Date(user.created_at).toLocaleDateString('uz-UZ')}`;

  if (user.is_payed && user.payed_cource) {
    for (const course of Object.values(courses)) {
      if (course.name === user.payed_cource && course.groupLink) {
        text += `\n\n🔗 <b>Guruh havolasi:</b>\n${course.groupLink}`;
        break;
      }
    }
  }

  await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

async function showAdminPanel(chatId) {
  const users = await getAllUsers();
  const paid = users.filter(u => u.is_payed).length;

  await bot.sendMessage(chatId,
    `👑 <b>Admin panel</b>\n\nJami: ${users.length} | To'lagan: ${paid}\n\nBo'limni tanlang:`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📚 Kurslarni boshqarish', callback_data: 'admin_courses' }],
          [{ text: '📢 Xabar yuborish (Broadcast)', callback_data: 'admin_broadcast' }],
          [{ text: '👥 Foydalanuvchilar', callback_data: 'admin_users' }],
          [{ text: '📊 Statistika', callback_data: 'admin_stats' }],
          [{ text: '🚪 Chiqish', callback_data: 'admin_logout' }]
        ]
      }
    }
  );
}

async function adminListCourses(chatId) {
  let text = '📚 <b>Kurslar</b>\n\n';
  const inlineKeyboard = { reply_markup: { inline_keyboard: [] } };

  for (const [id, course] of Object.entries(courses)) {
    text += `<b>${course.name}</b>\n💰 ${course.display_price}\n🔗 ${course.groupLink || 'Guruh yo\'q'}\n\n`;
    inlineKeyboard.reply_markup.inline_keyboard.push([
      { text: `✏️ ${course.name}`, callback_data: `edit_course|${id}` }
    ]);
  }

  inlineKeyboard.reply_markup.inline_keyboard.push([
    { text: '🔙 Orqaga', callback_data: 'admin_back' }
  ]);

  await bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...inlineKeyboard });
}

async function adminEditCourse(chatId, courseId) {
  const course = courses[courseId];
  if (!course) return bot.sendMessage(chatId, '❌ Kurs topilmadi.');

  await bot.sendMessage(chatId,
    `📚 <b>${course.name}</b>\n\n💰 ${course.display_price}\n📝 ${course.description.substring(0, 100)}...\n🔗 ${course.groupLink || 'Mavjud emas'}\n💳 ${course.paymentLink || 'Avtomatik Payme'}\n\n✏️ Qaysi maydonni o'zgartirmoqchisiz?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 Nomi', callback_data: `edit_field|${courseId}|name` }],
          [{ text: '💰 Narx (ko\'rinishi)', callback_data: `edit_field|${courseId}|display_price` }],
          [{ text: '💰 Payme narxi', callback_data: `edit_field|${courseId}|price` }],
          [{ text: '📋 Tavsif', callback_data: `edit_field|${courseId}|description` }],
          [{ text: '🔗 Guruh havolasi', callback_data: `edit_field|${courseId}|groupLink` }],
          [{ text: '💳 To\'lov havolasi', callback_data: `edit_field|${courseId}|paymentLink` }],
          [{ text: '🔙 Orqaga', callback_data: 'admin_courses' }]
        ]
      }
    }
  );
}

async function adminShowUsers(chatId) {
  const users = await getAllUsers();
  if (users.length === 0) return bot.sendMessage(chatId, '👥 Foydalanuvchilar topilmadi.');

  let text = `👥 <b>Foydalanuvchilar (${users.length})</b>\n\n`;
  users.slice(0, 30).forEach((u, i) => {
    text += `${i + 1}. ${u.full_name || 'Noma\'lum'} | ${u.phone_number || '-'} | ${u.is_payed ? '✅' : '❌'} | ID:${u.id}\n`;
  });
  if (users.length > 30) text += `\n... va yana ${users.length - 30} ta`;

  await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

async function adminShowStats(chatId) {
  const users = await getAllUsers();
  const paid = users.filter(u => u.is_payed);
  const notPaid = users.filter(u => !u.is_payed);
  const withPhone = users.filter(u => u.phone_number);
  const withName = users.filter(u => u.full_name);

  const courseDist = {};
  users.forEach(u => {
    if (u.payed_cource) courseDist[u.payed_cource] = (courseDist[u.payed_cource] || 0) + 1;
  });

  let text = '📊 <b>Statistika</b>\n\n';
  text += `👥 Jami: ${users.length}\n`;
  text += `✅ To'lagan: ${paid.length}\n`;
  text += `❌ To'lamagan: ${notPaid.length}\n`;
  text += `📱 Tel kiritgan: ${withPhone.length}\n`;
  text += `👤 Ism kiritgan: ${withName.length}\n\n`;
  text += '📚 Kurslar bo\'yicha:\n';
  for (const [name, count] of Object.entries(courseDist)) {
    text += `  • ${name}: ${count} ta\n`;
  }

  await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

console.log('🤖 Bot ishga tushdi...');

process.on('SIGINT', () => { saveCourses(); console.log('Bot stopped.'); process.exit(); });
process.on('SIGTERM', () => { saveCourses(); console.log('Bot stopped.'); process.exit(); });
