// public/script.js

let selectedDate = null;
let selectedTime = null;
window.telegramUserId = null; // Глобальная переменная для хранения id пользователя

// Функция синхронизации профиля Telegram
function syncProfile() {
  if (Telegram.WebApp && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user) {
    const user = Telegram.WebApp.initDataUnsafe.user;
    window.telegramUserId = String(user.id);
    alert(`Синхронизировано: ${user.first_name}`);
  } else {
    alert("Телеграм профиль не найден");
  }
}

// Открытие раздела "Записаться"
function openBooking() {
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('booking-section').classList.remove('hidden');
  renderCalendar();
}

// Открытие раздела "Мои записи"
function openMyBooking() {
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('my-bookings-section').classList.remove('hidden');
  renderMyBooking();
}

function renderMyBooking() {
  if (!window.telegramUserId) {
    alert("Сначала синхронизируйте профиль");
    return;
  }
  axios.get('/api/bookings', {
    params: { telegramUserId: window.telegramUserId }
  })
  .then(response => {
    const bookings = response.data;
    const list = document.getElementById('booking-list');
    list.innerHTML = '';
    if (bookings.length === 0) {
      list.innerHTML = '<li>Нет записей</li>';
    } else {
      bookings.forEach(booking => {
        const li = document.createElement('li');
        // Отображаем время с учетом часового пояса Екатеринбурга
        const bookingTime = new Date(booking.bookingTime);
        li.textContent = bookingTime.toLocaleString("ru-RU", { timeZone: "Asia/Yekaterinburg" });
        list.appendChild(li);
      });
    }
  })
  .catch(error => {
    console.error(error);
    alert("Ошибка загрузки записей");
  });
}

// Рендеринг календаря с учетом часового пояса Екатеринбурга
function renderCalendar() {
  const calendarContainer = document.getElementById('calendar-container');
  calendarContainer.innerHTML = '';
  // Получаем текущую дату в часовом поясе Екатеринбурга
  const todayEkb = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Yekaterinburg" }));
  for (let i = 0; i < 30; i++) {
    const date = new Date(todayEkb);
    date.setDate(todayEkb.getDate() + i);
    const dateBtn = document.createElement('button');
    dateBtn.textContent = `${date.getDate()}/${date.getMonth() + 1}`;
    dateBtn.onclick = () => selectDate(date, dateBtn);
    calendarContainer.appendChild(dateBtn);
  }
}

function selectDate(date, button) {
  selectedDate = date;
  document.querySelectorAll('.calendar button').forEach(btn => btn.classList.remove('selected'));
  button.classList.add('selected');
  renderTimeSlots();
}

// Пример отрисовки слотов времени с возможностью задать диапазон
function renderTimeSlots() {
  const slotsContainer = document.getElementById('time-slots');
  const timeText = document.getElementById('timeText');
  slotsContainer.innerHTML = '';
  timeText.classList.remove('hidden');

  // Пример: создаем слоты с интервалом 30 минут между 10:00 и 18:00
  const startHour = 10;
  const endHour = 18;
  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += 30) {
      // Форматируем время с ведущими нулями
      const timeStr = ("0" + hour).slice(-2) + ":" + ("0" + min).slice(-2);
      const slotBtn = document.createElement('button');
      slotBtn.textContent = timeStr;
      slotBtn.onclick = () => selectTime(timeStr, slotBtn);
      slotsContainer.appendChild(slotBtn);
    }
  }
}

function selectTime(time, button) {
  selectedTime = time;
  document.querySelectorAll('.time-slots button').forEach(btn => btn.classList.remove('selected'));
  button.classList.add('selected');
}

// Подтверждение записи с отправкой на сервер
function confirmBooking() {
  if (selectedDate && selectedTime && window.telegramUserId) {
    // Преобразуем дату в формат YYYY-MM-DD
    const year = selectedDate.getFullYear();
    const month = ('0' + (selectedDate.getMonth() + 1)).slice(-2);
    const day = ('0' + selectedDate.getDate()).slice(-2);
    const formattedDate = `${year}-${month}-${day}`;

    axios.post('/api/bookings', {
      telegramUserId: window.telegramUserId,
      bookingDate: formattedDate,
      bookingTime: selectedTime
    })
    .then(response => {
      alert(`Запись подтверждена на ${selectedDate.toLocaleDateString("ru-RU", { timeZone: "Asia/Yekaterinburg" })} в ${selectedTime}`);
      goBack();
    })
    .catch(error => {
      console.error(error);
      alert("Ошибка записи");
    });
  } else {
    alert('Сначала синхронизируйте профиль и выберите дату и время');
  }
}

// Возврат к главному меню
function goBack() {
  document.querySelectorAll('section').forEach(section => section.classList.add('hidden'));
  document.getElementById('main-menu').classList.remove('hidden');
}
