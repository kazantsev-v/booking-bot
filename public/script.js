let selectedDate = null;
let selectedTime = null;

// Открытие раздела записаться
function openBooking() {
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('booking-section').classList.remove('hidden');
  renderCalendar();
}

// Открытие раздела мои записи
function openMyBooking() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('my-bookings-section').classList.remove('hidden');
    renderMyBooking();
  }

function renderMyBooking() {
    document.innerHTML = "HAAHHAHAHAHAAH"
    document.getElementById('booking-list').innerText = "HAHAHAHAHHAAH"
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

  timeText.classList.remove('hidden')
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
  if (selectedDate && selectedTime) {
    alert(`Вы записаны на ${selectedDate.toLocaleDateString()} в ${selectedTime}`);
    goBack();
  } else {
    alert('Выберите дату и время');
  }
}

// Возврат к меню
function goBack() {
  document.querySelectorAll('section').forEach(section => section.classList.add('hidden'));
  document.getElementById('main-menu').classList.remove('hidden');
}
