// public/script.js

let selectedDate = null;
let selectedTime = null;
window.telegramUserId = null; // Глобальная переменная для хранения id пользователя
window.currentSystem = null;  // Текущая система, выбранная при поиске

// Синхронизация профиля сразу при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
  syncProfile();
});

// Функция синхронизации профиля Telegram
function syncProfile() {
  if (Telegram.WebApp && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user) {
    const user = Telegram.WebApp.initDataUnsafe.user;
    window.telegramUserId = String(user.id);
    // Можно также отобразить имя пользователя на странице
    console.log(`Синхронизировано: ${user.first_name}`);
  } else {
    alert("Телеграм профиль не найден");
  }
}

// Открытие раздела "Поиск системы"
function openSearchSystem() {
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('search-system-section').classList.remove('hidden');
}

// Поиск системы по уникальному имени
function searchSystem() {
  const uniqueName = document.getElementById('system-search-input').value.trim();
  if (!uniqueName) {
    alert("Введите уникальное имя системы");
    return;
  }
  axios.get('/api/systems', { params: { uniqueName } })
    .then(response => {
      window.currentSystem = response.data;
      // Отобразим информацию о системе
      document.getElementById('system-info').innerText = `Система: ${window.currentSystem.uniqueName}. Дни: ${window.currentSystem.availableDays}. Время: ${window.currentSystem.startTime}-${window.currentSystem.endTime}`;
      // Переходим к разделу записи
      document.getElementById('search-system-section').classList.add('hidden');
      document.getElementById('booking-section').classList.remove('hidden');
      renderCalendar();
    })
    .catch(error => {
      console.error(error);
      alert("Система не найдена");
    });
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
        const bookingTime = new Date(booking.bookingTime);
        // Если есть привязка к системе, отображаем её уникальное имя
        li.textContent = bookingTime.toLocaleString("ru-RU", { timeZone: "Asia/Yekaterinburg" }) + (booking.systemName ? ` (система: ${booking.systemName})` : "");
        list.appendChild(li);
      });
    }
  })
  .catch(error => {
    console.error(error);
    alert("Ошибка загрузки записей");
  });
}

// Рендеринг календаря с учетом часового пояса Екатеринбурга и ограничений системы
function renderCalendar() {
  const calendarContainer = document.getElementById('calendar-container');
  calendarContainer.innerHTML = '';
  // Текущая дата в часовом поясе Екатеринбурга
  const todayEkb = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Yekaterinburg" }));
  // Если система выбрана и заданы дни, отбираем только допустимые
  const allowedDays = window.currentSystem ? window.currentSystem.availableDays.split(',').map(day => day.trim()) : null;
  // Для сопоставления: 0=Вс, 1=Пн, 2=Вт, ..., 6=Сб
  const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(todayEkb);
    date.setDate(todayEkb.getDate() + i);
    const dayAbbr = dayNames[date.getDay()];
    // Если система выбрана, показываем только те дни, которые разрешены
    if (allowedDays && !allowedDays.includes(dayAbbr)) continue;
    
    const dateBtn = document.createElement('button');
    dateBtn.textContent = `${date.getDate()}/${date.getMonth() + 1} (${dayAbbr})`;
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

// Рендеринг слотов времени с учетом системы (если выбрана) или стандартно
function renderTimeSlots() {
  const slotsContainer = document.getElementById('time-slots');
  const timeText = document.getElementById('timeText');
  slotsContainer.innerHTML = '';
  timeText.classList.remove('hidden');

  let startHour = 10, endHour = 18;
  if (window.currentSystem) {
    // Предполагаем, что время записано в формате HH:MM
    startHour = parseInt(window.currentSystem.startTime.split(':')[0]);
    endHour = parseInt(window.currentSystem.endTime.split(':')[0]);
  }
  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += 30) {
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

// Подтверждение записи с передачей systemId (если система выбрана)
function confirmBooking() {
  if (selectedDate && selectedTime && window.telegramUserId) {
    const year = selectedDate.getFullYear();
    const month = ('0' + (selectedDate.getMonth() + 1)).slice(-2);
    const day = ('0' + selectedDate.getDate()).slice(-2);
    const formattedDate = `${year}-${month}-${day}`;

    axios.post('/api/bookings', {
      telegramUserId: window.telegramUserId,
      systemId: window.currentSystem ? window.currentSystem.id : null,
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
  // Сбрасываем текущую систему, если она была выбрана
  window.currentSystem = null;
}
