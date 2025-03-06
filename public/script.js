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

// Открытие раздела записаться
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
        const bookingTime = new Date(booking.bookingTime);
        li.textContent = bookingTime.toLocaleString();
        list.appendChild(li);
      });
    }
  })
  .catch(error => {
    console.error(error);
    alert("Ошибка загрузки записей");
  });
}

// Рендеринг календаря
function renderCalendar() {
  const calendarContainer = document.getElementById('calendar-container');
  calendarContainer.innerHTML = '';

  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

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

// Рендеринг слотов времени
function renderTimeSlots() {
  const timeSlots = ['10:00', '11:00', '12:00', '13:00', '14:00'];
  const slotsContainer = document.getElementById('time-slots');
  const timeText = document.getElementById('timeText');
  slotsContainer.innerHTML = '';

  timeText.classList.remove('hidden');
  timeSlots.forEach(slot => {
    const slotBtn = document.createElement('button');
    slotBtn.textContent = slot;
    slotBtn.onclick = () => selectTime(slot, slotBtn);
    slotsContainer.appendChild(slotBtn);
  });
}

function selectTime(time, button) {
  selectedTime = time;
  document.querySelectorAll('.time-slots button').forEach(btn => btn.classList.remove('selected'));
  button.classList.add('selected');
}

// Подтверждение записи
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
      alert(`Запись подтверждена на ${selectedDate.toLocaleDateString()} в ${selectedTime}`);
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

// Возврат к меню
function goBack() {
  document.querySelectorAll('section').forEach(section => section.classList.add('hidden'));
  document.getElementById('main-menu').classList.remove('hidden');
}
