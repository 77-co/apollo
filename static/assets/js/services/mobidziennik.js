let currentEvents = [];

const mobiWidget = document.getElementById('mobidziennik');
const mobiApp = document.getElementById('mobidziennikApp');

// Comprehensive Polish translations for event types from your data
const eventTypeTranslations = {
    // From your actual data
    'dictation': 'dyktando',
    'quiz': 'kartkówka',
    'test': 'sprawdzian',
    'other': 'wydarzenie',
    'holiday': 'dzień wolny',
    'meeting': 'zebranie',
    'grades': 'oceny',
    'end_of_term': 'zakończenie',
    
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    updateMobiEvents();
    // Update every 30 minutes
    setInterval(updateMobiEvents, 30 * 60 * 1000);
});

// Listen for app open event
if (mobiApp) {
    mobiApp.addEventListener('appopen', () => {
        loadAppEvents('upcoming');
    });
}

async function updateMobiEvents() {
    try {
        // Show loading state
        mobiWidget.querySelector('.mobiLoginAlert').classList.add('active');
        
        // Get upcoming events for the next 14 days (since it's June 2025, we need a longer range)
        const response = await window.backend.mobidziennik.getUpcoming({ days: 30 });
        
        if (response.success && response.data.events.length > 0) {
            // Filter events that are actually in the future
            const now = new Date();
            now.setHours(0, 0, 0, 0); // Start of today
            
            currentEvents = response.data.events.filter(event => {
                const eventDate = new Date(event.date);
                return eventDate >= now;
            }).sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date
            
            if (currentEvents.length > 0) {
                displayNextEvent();
                mobiWidget.querySelector('.mobiLoginAlert').classList.remove('active');
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

    // Get the very next event (first in the sorted array)
    const nextEvent = currentEvents[0];
    const eventDate = new Date(nextEvent.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Format date display in Polish
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
    } else if (daysDiff <= 14) {
        dateDisplay = `za ${daysDiff} dni`;
    } else {
        dateDisplay = eventDate.toLocaleDateString('pl-PL', { 
            day: 'numeric', 
            month: 'long' 
        });
    }

    // Translate event type to Polish
    const eventType = nextEvent.event_type ? 
        eventTypeTranslations[nextEvent.event_type.toLowerCase()] || nextEvent.event_type : 
        'wydarzenie';

    // Clean up title - remove escape characters and truncate if too long
    let title = nextEvent.title || nextEvent.subject || 'Wydarzenie';
    title = title.replace(/\\/g, '').replace(/\.\.\./g, '');

    let description = nextEvent.description || '';
    description = description.replace(/\\/g, '').replace(/&amp;/g, '&');
    
    // Update widget content
    mobiWidget.querySelector('.event-title').textContent = description;
    mobiWidget.querySelector('.event-date').textContent = dateDisplay;
    mobiWidget.querySelector('.event-type').textContent = eventType;
    
    // Remove no-events class if it was previously added
    mobiWidget.querySelector('.current-event').classList.remove('no-events');
    mobiWidget.querySelector('.event-type').style.display = 'block';
}

function showNoEvents() {
    mobiWidget.querySelector('.current-event').classList.add('no-events');
    mobiWidget.querySelector('.event-title').textContent = 'Brak nadchodzących wydarzeń';
    mobiWidget.querySelector('.event-date').textContent = 'Sprawdź później';
    mobiWidget.querySelector('.event-type').style.display = 'none';
    mobiWidget.querySelector('.mobiLoginAlert').classList.remove('active');
}

function showError() {
    mobiWidget.querySelector('.current-event').classList.add('no-events');
    mobiWidget.querySelector('.event-title').textContent = 'Błąd połączenia';
    mobiWidget.querySelector('.event-date').textContent = 'Spróbuj ponownie później';
    mobiWidget.querySelector('.event-type').style.display = 'none';
    mobiWidget.querySelector('.mobiLoginAlert').classList.remove('active');
}

// App functionality (keeping existing app code with updated translations)
async function loadAppEvents(filter) {
    const eventsContainer = mobiApp.querySelector('.mobi-events');
    
    // Show loading state
    showLoadingState(eventsContainer);
    
    try {
        let response;
        
        switch (filter) {
            case 'today':
                response = await window.backend.mobidziennik.getEvents({ day: 'today' });
                break;
            case 'tomorrow':
                response = await window.backend.mobidziennik.getEvents({ day: 'tomorrow' });
                break;
            case 'upcoming':
                response = await window.backend.mobidziennik.getUpcoming({ days: 60 });
                break;
            case 'quiz':
                response = await window.backend.mobidziennik.getUpcoming({ days: 60, eventType: 'quiz' });
                break;
            case 'test':
                response = await window.backend.mobidziennik.getUpcoming({ days: 60, eventType: 'test' });
                break;
            default:
                response = await window.backend.mobidziennik.getUpcoming({ days: 60 });
        }
        
        if (response.success && response.data.events && response.data.events.length > 0) {
            // Filter future events for app display too
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            
            const futureEvents = response.data.events.filter(event => {
                const eventDate = new Date(event.date);
                return eventDate >= now;
            }).sort((a, b) => new Date(a.date) - new Date(b.date));
            
            if (futureEvents.length > 0) {
                displayAppEvents(futureEvents);
            } else {
                showNoAppEvents();
            }
        } else {
            showNoAppEvents();
        }
    } catch (error) {
        console.error('Error loading app events:', error);
        showAppError();
    }
}

function showLoadingState(container) {
    container.innerHTML = `
        <div class="loading-indicator">
            <div class="loading-spinner"></div>
            <p>Ładowanie wydarzeń...</p>
        </div>
    `;
}

function displayAppEvents(events) {
    const eventsContainer = mobiApp.querySelector('.mobi-events');
    eventsContainer.innerHTML = '';
    
    events.forEach(event => {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'mobi-event';
        
        const eventDate = new Date(event.date);
        const dateDisplay = eventDate.toLocaleDateString('pl-PL', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Translate event type for app display too
        const eventType = event.event_type ? 
            eventTypeTranslations[event.event_type.toLowerCase()] || event.event_type : 
            'wydarzenie';
        
        // Clean up title and description
        let title = event.title || event.subject || 'Wydarzenie';
        title = title.replace(/\\/g, '').replace(/\.\.\./g, '');
        
        let description = event.description || '';
        description = description.replace(/\\/g, '').replace(/&amp;/g, '&');
        
        eventDiv.innerHTML = `
            <div class="event-header">
                <h3 class="event-title">${title}</h3>
                <span class="event-type-badge">${eventType}</span>
            </div>
            ${description ? `<div class="event-details">${description}</div>` : ''}
            <div class="event-footer">
                <span class="event-date-full">${dateDisplay}</span>
                ${event.subject ? `<span class="event-subject">${event.subject}</span>` : ''}
            </div>
        `;
        
        eventsContainer.appendChild(eventDiv);
    });
}

function showNoAppEvents() {
    const eventsContainer = mobiApp.querySelector('.mobi-events');
    eventsContainer.innerHTML = '<div class="no-events">Brak wydarzeń w wybranej kategorii</div>';
}

function showAppError() {
    const eventsContainer = mobiApp.querySelector('.mobi-events');
    eventsContainer.innerHTML = '<div class="no-events">Błąd podczas ładowania wydarzeń</div>';
}

// Filter event listeners
if (mobiApp) {
    mobiApp.addEventListener('click', (e) => {
        const filterItem = e.target.closest('.filter-item');
        if (filterItem) {
            // Update active filter
            mobiApp.querySelectorAll('.filter-item').forEach(item => item.classList.remove('active'));
            filterItem.classList.add('active');
            
            // Load events for selected filter
            const filter = filterItem.getAttribute('data-filter');
            loadAppEvents(filter);
        }
    });
}