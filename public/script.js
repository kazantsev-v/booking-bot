// public/script.js

let selectedDate = null;
let selectedTime = null;
window.telegramUserId = null;
window.selectedBookingSystem = null;

// Синхронизация профиля Telegram
function syncProfile() {
  if (Telegram.WebApp && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user) {
    const user = Telegram.WebApp.initDataUnsafe.user;
    window.telegramUserId = String(user.id);
    alert(`Синхронизировано: ${user.first_name}`);
  } else {
    alert("Телеграм профиль не найден");
  }
}

// Переход к главному меню
function goBackToMain() {
  document.querySelectorAll('section').forEach(section => section.classList.add('hidden'));
  document.getElementById('main-menu').classList.remove('hidden');
}

// Открытие раздела создания системы бронирования
function openCreateSystem() {
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('create-system-section').classList.remove('hidden');
}

// Создание системы бронирования
function createSystem() {
  const name = document.getElementById('systemName').value.trim();
  const daysCheckboxes = document.querySelectorAll('input[name="availableDays"]:checked');
  let availableDays = [];
  daysCheckboxes.forEach(chk => {
    availableDays.push(chk.value);
  });
  const startTime = document.getElementById('startTime').value;
  const endTime = document.getElementById('endTime').value;

  if (!name || availableDays.length === 0 || !startTime || !endTime) {
    alert("Пожалуйста, заполните все поля.");
    return;
  }
  
  axios.post('/api/booking-systems', { name, availableDays, startTime, endTime })
  .then(response => {
    alert("Система бронирования создана!");
    goBackToMain();
  })
  .catch(error => {
    console.error(error);
    alert("Ошибка создания системы бронирования");
  });
}

// Открытие раздела выбора системы бронирования
function openBooking() {
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('systems-list-section').classList.remove('hidden');
  loadBookingSystems();
}

// Загрузка списка систем бронирования с поиском
function loadBookingSystems() {
  const searchQuery = document.getElementById('searchSystems').value;
  axios.get('/api/booking-systems', { params: { q: searchQuery } })
  .then(response => {
    const systems = response.data;
    const list = document.getElementById('systems-list');
    list.innerHTML = '';
    if (systems.length === 0) {
      list.innerHTML = '<li>Нет систем бронирования</li>';
    } else {
      systems.forEach(system => {
        const li = document.createElement('li');
        li.textContent = `${system.name} (Время: ${system.startTime} - ${system.endTime}, Дни: ${system.availableDays}) `;
        const selectBtn = document.createElement('button');
        selectBtn.textContent = "Выбрать";
        selectBtn.onclick = () => selectBookingSystem(system);
        li.appendChild(selectBtn);
        list.appendChild(li);
      });
    }
  })
  .catch(error => {
    console.error(error);
    alert("Ошибка загрузки систем бронирования");
  });
}

// Выбор системы бронирования и переход к записи
function selectBookingSystem(system) {
  window.selectedBookingSystem = system;
  document.getElementById('systems-list-section').classList.add('hidden');
  document.getElementById('booking-section').classList.remove('hidden');
  renderCalendarForSystem(system);
}

// Рендер календаря с учётом рабочих дней выбранной системы
function renderCalendarForSystem(system) {
  const calendarContainer = document.getElementById('calendar-container');
  calendarContainer.innerHTML = '';

  const today = new Date();
  let addedCount = 0;
  let day = new Date(today);
  // Добавляем 30 доступных дат, проверяя, соответствует ли день недели системе
  while (addedCount < 30) {
    const availableDays = system.availableDays.split(',').map(Number);
    if (availableDays.includes(day.getDay())) {
      const dateBtn = document.createElement('button');
      dateBtn.textContent = `${day.getDate()}/${day.getMonth() + 1}`;
      dateBtn.onclick = () => selectDate(day, dateBtn);
      calendarContainer.appendChild(dateBtn);
      addedCount++;
    }
    day.setDate(day.getDate() + 1);
  }
  renderTimeSlotsForSystem(system);
}

// Выбор даты
function selectDate(date, button) {
  selectedDate = date;
  document.querySelectorAll('.calendar button').forEach(btn => btn.classList.remove('selected'));
  button.classList.add('selected');
}

// Рендер временных слотов с учётом выбранной системы
function renderTimeSlotsForSystem(system) {
  const slotsContainer = document.getElementById('time-slots');
  const timeText = document.getElementById('timeText');
  slotsContainer.innerHTML = '';
  timeText.classList.remove('hidden');

  let startHour = parseInt(system.startTime.split(':')[0]);
  let endHour = parseInt(system.endTime.split(':')[0]);
  let timeSlots = [];
  for (let hour = startHour; hour < endHour; hour++) {
    let timeStr = (hour < 10 ? '0' + hour : hour) + ":00";
    timeSlots.push(timeStr);
  }
  timeSlots.forEach(slot => {
    const slotBtn = document.createElement('button');
    slotBtn.textContent = slot;
    slotBtn.onclick = () => selectTime(slot, slotBtn);
    slotsContainer.appendChild(slotBtn);
  });
}

// Выбор временного слота
function selectTime(time, button) {
  selectedTime = time;
  document.querySelectorAll('.time-slots button').forEach(btn => btn.classList.remove('selected'));
  button.classList.add('selected');
}

// Подтверждение записи
function confirmBooking() {
  if (selectedDate && selectedTime && window.telegramUserId && window.selectedBookingSystem) {
    const year = selectedDate.getFullYear();
    const month = ('0' + (selectedDate.getMonth() + 1)).slice(-2);
    const day = ('0' + selectedDate.getDate()).slice(-2);
    const formattedDate = `${year}-${month}-${day}`;

    axios.post('/api/bookings', {
      telegramUserId: window.telegramUserId,
      bookingDate: formattedDate,
      bookingTime: selectedTime,
      bookingSystemId: window.selectedBookingSystem.id
    })
    .then(response => {
      alert(`Запись подтверждена на ${selectedDate.toLocaleDateString()} в ${selectedTime}`);
      goBackToMain();
    })
    .catch(error => {
      console.error(error);
      alert("Ошибка записи");
    });
  } else {
    alert('Сначала синхронизируйте профиль, выберите систему бронирования, дату и время');
  }
}

// Открытие раздела "Мои записи"
function openMyBooking() {
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('my-bookings-section').classList.remove('hidden');
  renderMyBooking();
}

// Рендер списка записей пользователя
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

// Возврат к главному меню
function goBack() {
  document.querySelectorAll('section').forEach(section => section.classList.add('hidden'));
  document.getElementById('main-menu').classList.remove('hidden');
}
