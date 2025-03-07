// public/script.js

let selectedDate = null;
let selectedTime = null;
let selectedSystem = null;
window.telegramUserId = null; // Глобальная переменная для хранения id пользователя

// Функция синхронизации профиля Telegram
function syncProfile() {
  if (Telegram.WebApp && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user) {
    const user = Telegram.WebApp.initDataUnsafe.user;
    window.telegramUserId = String(user.id);
    document.getElementById('user-welcome').innerText = `Привет, ${user.first_name}!`;
    document.getElementById('sync-status').innerText = 'Профиль синхронизирован';
    document.getElementById('sync-status').classList.add('synced');
  } else {
    alert("Телеграм профиль не найден");
  }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  // Автоматическая синхронизация профиля при загрузке
  syncProfile();
  
  // Отображение секции с приветствием и основными кнопками
  showSection('welcome-section');
});

// Показать определенную секцию, скрыв остальные
function showSection(sectionId) {
  document.querySelectorAll('section').forEach(section => {
    section.classList.add('hidden');
  });
  document.getElementById(sectionId).classList.remove('hidden');
}

// Открытие раздела "Создать систему бронирования"
function openCreateSystem() {
  if (!window.telegramUserId) {
    alert("Сначала синхронизируйте профиль");
    return;
  }
  
  showSection('create-system-section');
}

// Создание новой системы бронирования
function createBookingSystem() {
  if (!window.telegramUserId) {
    alert("Сначала синхронизируйте профиль");
    return;
  }
  
  const name = document.getElementById('system-name').value;
  const workDays = [];
  
  // Получаем выбранные дни недели
  document.querySelectorAll('#work-days input:checked').forEach(checkbox => {
    workDays.push(checkbox.value);
  });
  
  const startTime = document.getElementById('start-time').value;
  const endTime = document.getElementById('end-time').value;
  
  if (!name || workDays.length === 0 || !startTime || !endTime) {
    alert("Пожалуйста, заполните все поля");
    return;
  }
  
  // Формируем данные для отправки
  const systemData = {
    name: name,
    creatorId: window.telegramUserId,
    workDays: workDays.join(','),
    workHours: `${startTime}-${endTime}`
  };
  
  // Отправляем запрос на создание системы
  axios.post('/api/booking-systems', systemData)
    .then(response => {
      alert(`Система бронирования "${name}" успешно создана!`);
      document.getElementById('create-system-form').reset();
      showSection('welcome-section');
    })
    .catch(error => {
      console.error("Ошибка создания системы:", error);
      alert("Произошла ошибка при создании системы бронирования");
    });
}

// Открытие раздела "Выбор системы бронирования"
function openBooking() {
  if (!window.telegramUserId) {
    alert("Сначала синхронизируйте профиль");
    return;
  }
  
  showSection('systems-list-section');
  loadBookingSystems();
}

// Загрузка списка систем бронирования
function loadBookingSystems(searchQuery = '') {
  const systemsContainer = document.getElementById('systems-container');
  systemsContainer.innerHTML = '<div class="loading">Загрузка систем бронирования...</div>';
  
  axios.get('/api/booking-systems', {
    params: { search: searchQuery }
  })
  .then(response => {
    const systems = response.data;
    systemsContainer.innerHTML = '';
    
    if (systems.length === 0) {
      systemsContainer.innerHTML = '<div class="no-results">Систем бронирования не найдено</div>';
      return;
    }
    
    systems.forEach(system => {
      const systemCard = document.createElement('div');
      systemCard.className = 'system-card';
      
      const workDays = system.work_days.split(',').map(day => {
        const dayMap = {
          'пн': 'Понедельник',
          'вт': 'Вторник',
          'ср': 'Среда',
          'чт': 'Четверг',
          'пт': 'Пятница',
          'сб': 'Суббота',
          'вс': 'Воскресенье'
        };
        return dayMap[day] || day;
      }).join(', ');
      
      systemCard.innerHTML = `
        <h3>${system.name}</h3>
        <p>Дни работы: ${workDays}</p>
        <p>Время работы: ${system.work_hours}</p>
        <button class="btn-select" onclick="selectSystem(${system.id})">Выбрать</button>
      `;
      
      systemsContainer.appendChild(systemCard);
    });
  })
  .catch(error => {
    console.error("Ошибка загрузки систем бронирования:", error);
    systemsContainer.innerHTML = '<div class="error">Ошибка загрузки данных</div>';
  });
}

// Поиск систем бронирования
function searchSystems() {
  const query = document.getElementById('system-search').value;
  loadBookingSystems(query);
}

// Выбор системы бронирования
function selectSystem(systemId) {
  axios.get(`/api/booking-systems/${systemId}`)
    .then(response => {
      selectedSystem = response.data;
      document.getElementById('selected-system-name').innerText = selectedSystem.name;
      showSection('booking-section');
      renderCalendar();
    })
    .catch(error => {
      console.error("Ошибка получения информации о системе:", error);
      alert("Ошибка при выборе системы бронирования");
    });
}

// Открытие раздела "Мои записи"
function openMyBookings() {
  if (!window.telegramUserId) {
    alert("Сначала синхронизируйте профиль");
    return;
  }
  
  showSection('my-bookings-section');
  renderMyBookings();
}

// Отображение списка записей пользователя
function renderMyBookings() {
  const bookingsList = document.getElementById('booking-list');
  bookingsList.innerHTML = '<li class="loading">Загрузка записей...</li>';
  
  axios.get('/api/bookings', {
    params: { telegramUserId: window.telegramUserId }
  })
  .then(response => {
    const bookings = response.data;
    bookingsList.innerHTML = '';
    
    if (bookings.length === 0) {
      bookingsList.innerHTML = '<li class="no-bookings">У вас нет активных записей</li>';
      return;
    }
    
    bookings.forEach(booking => {
      const li = document.createElement('li');
      li.className = 'booking-item';
      
      const bookingTime = new Date(booking.bookingTime);
      const systemName = booking.systemName || 'Неизвестная система';
      
      li.innerHTML = `
        <div class="booking-system">${systemName}</div>
        <div class="booking-time">${bookingTime.toLocaleString()}</div>
      `;
      
      bookingsList.appendChild(li);
    });
  })
  .catch(error => {
    console.error("Ошибка загрузки записей:", error);
    bookingsList.innerHTML = '<li class="error">Ошибка загрузки данных</li>';
  });
}

// Рендеринг календаря с учетом дней работы выбранной системы
function renderCalendar() {
  if (!selectedSystem) return;
  
  const calendarContainer = document.getElementById('calendar-container');
  calendarContainer.innerHTML = '';
  
  // Получаем массив дней недели, в которые работает система
  const workDays = selectedSystem.work_days.split(',').map(day => day.trim().toLowerCase());
  
  // Маппинг сокращений дней недели на числовые значения (0 - воскресенье, 1 - понедельник и т.д.)
  const dayMapping = {
    'вс': 0, 'пн': 1, 'вт': 2, 'ср': 3, 'чт': 4, 'пт': 5, 'сб': 6
  };
  
  // Преобразуем сокращения в числовые значения
  const workDaysNumeric = workDays.map(day => dayMapping[day]);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Отображаем даты на 30 дней вперед
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    const dayOfWeek = date.getDay(); // 0 - воскресенье, 1 - понедельник, ...
    
    // Проверяем, работает ли система в этот день недели
    const isWorkDay = workDaysNumeric.includes(dayOfWeek);
    
    const dateBtn = document.createElement('button');
    dateBtn.textContent = `${date.getDate()}/${date.getMonth() + 1}`;
    dateBtn.classList.add('date-btn');
    
    if (isWorkDay) {
      dateBtn.onclick = () => selectDate(date, dateBtn);
    } else {
      dateBtn.classList.add('disabled');
      dateBtn.disabled = true;
    }
    
    calendarContainer.appendChild(dateBtn);
  }
}

// Выбор даты записи
function selectDate(date, button) {
  selectedDate = date;
  document.querySelectorAll('.date-btn').forEach(btn => btn.classList.remove('selected'));
  button.classList.add('selected');
  renderTimeSlots();
}

// Рендеринг временных слотов с учетом часов работы выбранной системы
function renderTimeSlots() {
  if (!selectedSystem || !selectedDate) return;
  
  const slotsContainer = document.getElementById('time-slots');
  slotsContainer.innerHTML = '';
  document.getElementById('time-heading').classList.remove('hidden');
  
  // Парсим время работы системы (формат "HH:MM-HH:MM")
  const [startTimeStr, endTimeStr] = selectedSystem.work_hours.split('-');
  
  // Парсим часы и минуты
  const startHour = parseInt(startTimeStr.split(':')[0]);
  const startMinute = parseInt(startTimeStr.split(':')[1] || 0);
  const endHour = parseInt(endTimeStr.split(':')[0]);
  const endMinute = parseInt(endTimeStr.split(':')[1] || 0);
  
  // Создаем временные слоты с интервалом в 1 час
  const slots = [];
  let hour = startHour;
  let minute = startMinute;
  
  while (hour < endHour || (hour === endHour && minute < endMinute)) {
    // Форматируем время в строку "HH:MM"
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    slots.push(timeStr);
    
    // Увеличиваем время на 1 час
    minute += 60;
    if (minute >= 60) {
      hour += Math.floor(minute / 60);
      minute = minute % 60;
    }
  }
  
  // Создаем кнопки для каждого временного слота
  slots.forEach(slot => {
    const slotBtn = document.createElement('button');
    slotBtn.textContent = slot;
    slotBtn.classList.add('time-btn');
    slotBtn.onclick = () => selectTime(slot, slotBtn);
    slotsContainer.appendChild(slotBtn);
  });
}

// Выбор времени записи
function selectTime(time, button) {
  selectedTime = time;
  document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('selected'));
  button.classList.add('selected');
}

// Подтверждение записи
function confirmBooking() {
  if (!selectedSystem || !selectedDate || !selectedTime || !window.telegramUserId) {
    alert('Необходимо выбрать дату и время записи');
    return;
  }
  
  // Форматируем дату в формат YYYY-MM-DD
  const year = selectedDate.getFullYear();
  const month = ('0' + (selectedDate.getMonth() + 1)).slice(-2);
  const day = ('0' + selectedDate.getDate()).slice(-2);
  const formattedDate = `${year}-${month}-${day}`;
  
  // Формируем данные для записи
  const bookingData = {
    telegramUserId: window.telegramUserId,
    systemId: selectedSystem.id,
    bookingDate: formattedDate,
    bookingTime: selectedTime
  };
  
  // Отправляем запрос на создание записи
  axios.post('/api/bookings', bookingData)
    .then(response => {
      alert(`Запись в "${selectedSystem.name}" на ${selectedDate.toLocaleDateString()} в ${selectedTime} успешно создана!`);
      resetBookingForm();
      showSection('welcome-section');
    })
    .catch(error => {
      console.error("Ошибка создания записи:", error);
      alert("Произошла ошибка при создании записи");
    });
}

// Сброс формы записи
function resetBookingForm() {
  selectedDate = null;
  selectedTime = null;
  selectedSystem = null;
  document.getElementById('time-heading').classList.add('hidden');
  document.getElementById('time-slots').innerHTML = '';
}

// Возврат к предыдущему экрану
function goBack(targetSection = 'welcome-section') {
  showSection(targetSection);
}