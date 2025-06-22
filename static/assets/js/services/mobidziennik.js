// Compact mobiDziennik functionality
let currentEvents = [];
let filteredEvents = [];
let currentFilter = 'all';

const mobiWidget = document.getElementById('mobidziennik');
const mobiApp = document.getElementById('mobidziennikApp');

// Event type translations
const eventTypeTranslations = {
    'dictation': 'Dyktando',
    'quiz': 'Kartkówka', 
    'test': 'Sprawdzian',
    'other': 'Wydarzenie',
    'holiday': 'Dzień wolny',
    'meeting': 'Zebranie',
    'grades': 'Oceny',
    'end_of_term': 'Zakończenie',
    'homework': 'Zadanie domowe',
    'project': 'Projekt',
    'exam': 'Egzamin'
};

// Priority mapping
const eventPriority = {
    'test': 3,
    'exam': 3,
    'quiz': 2,
    'dictation': 2,
    'homework': 1,
    'other': 0
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateMobiEvents();
    setInterval(updateMobiEvents, 30 * 60 * 1000);
});

// App open event
if (mobiApp) {
    mobiApp.addEventListener('appopen', () => {
        loadAppEvents();
        setupEventListeners();
    });
}

function setupEventListeners() {
    // Filter listeners
    mobiApp.querySelectorAll('.filter-item').forEach(item => {
        item.addEventListener('click', () => {
            mobiApp.querySelectorAll('.filter-item').forEach(f => f.classList.remove('active'));
            item.classList.add('active');
            currentFilter = item.dataset.filter;
            filterAndDisplayEvents();
        });
    });

    
}

async function updateMobiEvents() {
    try {
        if (mobiWidget.querySelector('.mobiLoginAlert')) {
            mobiWidget.querySelector('.mobiLoginAlert').classList.add('active');
        }
        
        const response = await window.backend.mobidziennik.getUpcoming({ days: 30 });
        
        if (response.success && response.data.events.length > 0) {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            
            currentEvents = response.data.events.filter(event => {
                const eventDate = new Date(event.date);
                return eventDate >= now;
            }).sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                if (dateA.getTime() === dateB.getTime()) {
                    return (eventPriority[b.event_type] || 0) - (eventPriority[a.event_type] || 0);
                }
                return dateA - dateB;
            });
            
            if (currentEvents.length > 0) {
                displayNextEvent();
                if (mobiWidget.querySelector('.mobiLoginAlert')) {
                    mobiWidget.querySelector('.mobiLoginAlert').classList.remove('active');
                }
            } else {
                showNoEvents();
            }
        } else {
            showNoEvents();
        }
    } catch (error) {
        console.error('Error updating Mobidziennik events:', error);
        showError();
    }
}

function displayNextEvent() {
    if (currentEvents.length === 0) {
        showNoEvents();
        return;
    }

    const nextEvent = currentEvents[0];
    const eventDate = new Date(nextEvent.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let dateDisplay;
    const daysDiff = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
        dateDisplay = 'Dzisiaj';
    } else if (daysDiff === 1) {
        dateDisplay = 'Jutro';
    } else if (daysDiff === 2) {
        dateDisplay = 'Pojutrze';
    } else if (daysDiff <= 7) {
        const weekdays = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
        dateDisplay = weekdays[eventDate.getDay()];
    } else {
        dateDisplay = `za ${daysDiff} dni`;
    }

    const eventType = nextEvent.event_type ? 
        eventTypeTranslations[nextEvent.event_type.toLowerCase()] || nextEvent.event_type : 
        'wydarzenie';

    let title = nextEvent.title || nextEvent.subject || 'Wydarzenie';
    title = title.replace(/\\/g, '').replace(/\.\.\./g, '');

    let description = nextEvent.description || '';
    description = description.replace(/\\/g, '').replace(/&amp;/g, '&');
    
    if (mobiWidget.querySelector('.event-title')) {
        mobiWidget.querySelector('.event-title').textContent = description || title;
        mobiWidget.querySelector('.event-date').textContent = dateDisplay;
        mobiWidget.querySelector('.event-type').textContent = eventType;
        mobiWidget.querySelector('.current-event').classList.remove('no-events');
        mobiWidget.querySelector('.event-type').style.display = 'block';
    }
}

function showNoEvents() {
    if (mobiWidget.querySelector('.current-event')) {
        mobiWidget.querySelector('.current-event').classList.add('no-events');
        mobiWidget.querySelector('.event-title').textContent = 'Brak wydarzeń';
        mobiWidget.querySelector('.event-date').textContent = '';
        mobiWidget.querySelector('.event-type').style.display = 'none';
        if (mobiWidget.querySelector('.mobiLoginAlert')) {
            mobiWidget.querySelector('.mobiLoginAlert').classList.remove('active');
        }
    }
}

function showError() {
    if (mobiWidget.querySelector('.current-event')) {
        mobiWidget.querySelector('.current-event').classList.add('no-events');
        mobiWidget.querySelector('.event-title').textContent = 'Błąd połączenia';
        mobiWidget.querySelector('.event-date').textContent = '';
        mobiWidget.querySelector('.event-type').style.display = 'none';
        if (mobiWidget.querySelector('.mobiLoginAlert')) {
            mobiWidget.querySelector('.mobiLoginAlert').classList.remove('active');
        }
    }
}

async function loadAppEvents() {
    const eventsList = mobiApp.querySelector('#eventsList');
    
    showLoadingState(eventsList);
    
    try {
        const response = await window.backend.mobidziennik.getUpcoming({ days: 60 });
        
        if (response.success && response.data.events && response.data.events.length > 0) {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            
            currentEvents = response.data.events.filter(event => {
                const eventDate = new Date(event.date);
                return eventDate >= now;
            }).sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                if (dateA.getTime() === dateB.getTime()) {
                    return (eventPriority[b.event_type] || 0) - (eventPriority[a.event_type] || 0);
                }
                return dateA - dateB;
            });
            
            updateStats();
            filterAndDisplayEvents();
        } else {
            showEmptyState();
        }
    } catch (error) {
        console.error('Error loading app events:', error);
        showErrorState();
    }
}

function updateStats() {

}

function filterAndDisplayEvents() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (currentFilter) {
        case 'today':
            filteredEvents = currentEvents.filter(e => {
                const eventDate = new Date(e.date);
                return eventDate.toDateString() === today.toDateString();
            });
            break;
        case 'week':
            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);
            filteredEvents = currentEvents.filter(e => {
                const eventDate = new Date(e.date);
                return eventDate >= today && eventDate < nextWeek;
            });
            break;
        case 'tests':
            filteredEvents = currentEvents.filter(e => 
                ['test', 'quiz', 'exam', 'dictation'].includes(e.event_type)
            );
            break;
        default:
            filteredEvents = [...currentEvents];
    }
    
    displayEvents();
}

function displayEvents() {
    const eventsList = mobiApp.querySelector('#eventsList');
    
    if (filteredEvents.length === 0) {
        showEmptyState();
        return;
    }
    
    eventsList.innerHTML = '';
    
    filteredEvents.forEach(event => {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'event-item';
        
        const eventDate = new Date(event.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysDiff = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
        
        if (['test', 'quiz', 'exam'].includes(event.event_type) && daysDiff <= 1) {
            eventDiv.classList.add('urgent');
        }
        
        const eventType = event.event_type ? 
            eventTypeTranslations[event.event_type.toLowerCase()] || event.event_type : 
            'Wydarzenie';
        
        let title = event.title || event.subject || 'Wydarzenie';
        title = title.replace(/\\/g, '').replace(/\.\.\./g, '');
        
        let description = event.description || '';
        description = description.replace(/\\/g, '').replace(/&amp;/g, '&');
        
        let dateDisplay;
        if (daysDiff === 0) {
            dateDisplay = 'Dzisiaj';
        } else if (daysDiff === 1) {
            dateDisplay = 'Jutro';
        } else if (daysDiff <= 7) {
            const weekdays = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
            dateDisplay = weekdays[eventDate.getDay()];
        } else {
            dateDisplay = eventDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
        }
        
        eventDiv.innerHTML = `
            <div class="event-header">
                <h4 class="event-title">${eventType}</h4>
                <div class="event-date">${dateDisplay}</div>
            </div>
            ${description ? `<div class="event-description">${description}</div>` : ''}
        `;
        
        eventsList.appendChild(eventDiv);
    });
}

function showLoadingState(container) {
    container.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Ładowanie...</p>
        </div>
    `;
}

function showEmptyState() {
    const eventsList = mobiApp.querySelector('#eventsList');
    eventsList.innerHTML = `
        <div class="empty-state">
            <span class="material-symbols-outlined">event_busy</span>
            <h3>Brak wydarzeń</h3>
            <p>Nie znaleziono wydarzeń</p>
        </div>
    `;
}

function showErrorState() {
    const eventsList = mobiApp.querySelector('#eventsList');
    eventsList.innerHTML = `
        <div class="empty-state">
            <span class="material-symbols-outlined">error</span>
            <h3>Błąd połączenia</h3>
            <p>Spróbuj ponownie</p>
        </div>
    `;
}