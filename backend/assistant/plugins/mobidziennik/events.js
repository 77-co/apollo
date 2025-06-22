import { spawn } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERNAME = process.env.MOBI_USERNAME;
const PASSWORD = process.env.MOBI_PASSWORD;

if (!USERNAME || !PASSWORD) {
  throw new Error('MOBI_USERNAME and MOBI_PASSWORD must be set in environment variables');
}

export default {
  /**
   * Get events for a specific day
   * @param {Object} options - Options object
   * @param {string} options.day - 'today', 'tomorrow', 'dayaftertomorrow', or specific date 'YYYY-MM-DD'
   * @returns {Promise} Promise resolving to events data
   */
  async execute({ day = 'tomorrow' } = {}) {
    return new Promise((resolve, reject) => {
      let targetDate = new Date();
      let daysToAdd = 0;

      // Handle specific date format (YYYY-MM-DD) or relative days
      if (day.match(/^\d{4}-\d{2}-\d{2}$/)) {
        targetDate = new Date(day);
        if (isNaN(targetDate.getTime())) {
          reject(new Error('Invalid date format. Use YYYY-MM-DD'));
          return;
        }
      } else {
        switch (day.toLowerCase()) {
          case 'tomorrow':
            daysToAdd = 1;
            break;
          case 'dayaftertomorrow':
            daysToAdd = 2;
            break;
          case 'today':
            daysToAdd = 0;
            break;
          default:
            reject(new Error('Invalid day parameter. Use "today", "tomorrow", "dayaftertomorrow", or YYYY-MM-DD format'));
            return;
        }
        targetDate.setDate(targetDate.getDate() + daysToAdd);
      }

      const targetDateStr = targetDate.toISOString().split('T')[0];
      const pythonScript = path.join(__dirname, 'mobi.py');
      
      const python = spawn(process.platform === 'win32' ? 'python' : 'python3', [
        pythonScript,
        '-u', USERNAME,
        '-p', PASSWORD,
        '--calendar'
      ], {
        encoding: 'utf-8'
      });
      
      let outputData = '';
      let errorData = '';
      
      python.stdout.on('data', (data) => {
        outputData += data.toString('utf-8');
      });
      
      python.stderr.on('data', (data) => {
        errorData += data.toString('utf-8');
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          try {
            const error = JSON.parse(errorData);
            reject(new Error(error.error));
          } catch {
            reject(new Error(`Python script failed: ${errorData}`));
          }
          return;
        }
      
        try {
          const fullData = JSON.parse(outputData);
          const allEvents = fullData.events || [];
          
          // Filter events for the target date
          const dayEvents = allEvents.filter(event => event.date === targetDateStr);
          
          resolve({
            date: targetDateStr,
            events: dayEvents,
            totalEvents: allEvents.length
          });
      
        } catch (error) {
          reject(new Error(`Failed to parse events output: ${error.message}`));
        }
      });
    });
  },

  /**
   * Get the weekly lesson schedule
   * @returns {Promise} Promise resolving to the weekly schedule
   */
  async getSchedule() {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, 'mobi.py');
      
      const python = spawn(process.platform === 'win32' ? 'python' : 'python3', [
        pythonScript,
        '-u', USERNAME,
        '-p', PASSWORD,
        '--schedule'
      ], {
        encoding: 'utf-8'
      });
      
      let outputData = '';
      let errorData = '';
      
      python.stdout.on('data', (data) => {
        outputData += data.toString('utf-8');
      });
      
      python.stderr.on('data', (data) => {
        errorData += data.toString('utf-8');
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          try {
            const error = JSON.parse(errorData);
            reject(new Error(error.error));
          } catch {
            reject(new Error(`Python script failed: ${errorData}`));
          }
          return;
        }
      
        try {
          const data = JSON.parse(outputData);
          resolve(data.schedule || {});
        } catch (error) {
          reject(new Error(`Failed to parse schedule output: ${error.message}`));
        }
      });
    });
  },

  /**
   * Get lessons for a specific day
   * @param {Object} options - Options object
   * @param {string} options.day - 'today', 'tomorrow', 'monday', 'tuesday', etc., or specific date 'YYYY-MM-DD'
   * @returns {Promise} Promise resolving to lessons for the day
   */
  async getLessons({ day = 'today' } = {}) {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, 'mobi.py');
      
      const python = spawn(process.platform === 'win32' ? 'python' : 'python3', [
        pythonScript,
        '-u', USERNAME,
        '-p', PASSWORD,
        '--schedule'
      ], {
        encoding: 'utf-8'
      });
      
      let outputData = '';
      let errorData = '';
      
      python.stdout.on('data', (data) => {
        outputData += data.toString('utf-8');
      });
      
      python.stderr.on('data', (data) => {
        errorData += data.toString('utf-8');
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          try {
            const error = JSON.parse(errorData);
            reject(new Error(error.error));
          } catch {
            reject(new Error(`Python script failed: ${errorData}`));
          }
          return;
        }
      
        try {
          const data = JSON.parse(outputData);
          const schedule = data.schedule || {};
          
          let targetWeekday;
          
          // Map day parameter to Polish weekday names
          const dayMapping = {
            'monday': 'poniedziałek',
            'tuesday': 'wtorek', 
            'wednesday': 'środa',
            'thursday': 'czwartek',
            'friday': 'piątek',
            'poniedziałek': 'poniedziałek',
            'wtorek': 'wtorek',
            'środa': 'środa',
            'czwartek': 'czwartek',
            'piątek': 'piątek'
          };
          
          if (day.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Specific date - convert to weekday
            const date = new Date(day);
            if (isNaN(date.getTime())) {
              reject(new Error('Invalid date format. Use YYYY-MM-DD'));
              return;
            }
            const weekdayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
            const weekdays = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
            targetWeekday = weekdays[weekdayIndex];
          } else if (dayMapping[day.toLowerCase()]) {
            targetWeekday = dayMapping[day.toLowerCase()];
          } else {
            // Handle relative days like 'today', 'tomorrow'
            let targetDate = new Date();
            let daysToAdd = 0;
            
            switch (day.toLowerCase()) {
              case 'tomorrow':
                daysToAdd = 1;
                break;
              case 'today':
                daysToAdd = 0;
                break;
              default:
                reject(new Error('Invalid day parameter. Use weekday names, "today", "tomorrow", or YYYY-MM-DD format'));
                return;
            }
            
            targetDate.setDate(targetDate.getDate() + daysToAdd);
            const weekdayIndex = targetDate.getDay();
            const weekdays = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
            targetWeekday = weekdays[weekdayIndex];
          }
          
          const lessons = schedule[targetWeekday] || [];
          
          resolve({
            weekday: targetWeekday,
            lessons: lessons,
            totalLessons: lessons.length
          });
        } catch (error) {
          reject(new Error(`Failed to parse schedule: ${error.message}`));
        }
      });
    });
  },

  /**
   * Get combined data for a specific day (events + lessons)
   * @param {Object} options - Options object
   * @param {string} options.day - 'today', 'tomorrow', weekday names, or specific date 'YYYY-MM-DD'
   * @returns {Promise} Promise resolving to combined day data
   */
  async getDayData({ day = 'today' } = {}) {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, 'mobi.py');
      
      const python = spawn(process.platform === 'win32' ? 'python' : 'python3', [
        pythonScript,
        '-u', USERNAME,
        '-p', PASSWORD,
        '--schedule',
        '--calendar'
      ], {
        encoding: 'utf-8'
      });
      
      let outputData = '';
      let errorData = '';
      
      python.stdout.on('data', (data) => {
        outputData += data.toString('utf-8');
      });
      
      python.stderr.on('data', (data) => {
        errorData += data.toString('utf-8');
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          try {
            const error = JSON.parse(errorData);
            reject(new Error(error.error));
          } catch {
            reject(new Error(`Python script failed: ${errorData}`));
          }
          return;
        }
      
        try {
          const data = JSON.parse(outputData);
          const schedule = data.schedule || {};
          const allEvents = data.events || [];
          
          let targetDate = new Date();
          let targetDateStr;
          let targetWeekday;
          
          // Parse day parameter
          if (day.match(/^\d{4}-\d{2}-\d{2}$/)) {
            targetDate = new Date(day);
            if (isNaN(targetDate.getTime())) {
              reject(new Error('Invalid date format. Use YYYY-MM-DD'));
              return;
            }
            targetDateStr = day;
          } else {
            let daysToAdd = 0;
            const dayMapping = {
              'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5,
              'poniedziałek': 1, 'wtorek': 2, 'środa': 3, 'czwartek': 4, 'piątek': 5
            };
            
            if (dayMapping[day.toLowerCase()]) {
              // Find next occurrence of this weekday
              const today = new Date();
              const todayWeekday = today.getDay(); // 0 = Sunday, 1 = Monday
              const targetWeekdayNum = dayMapping[day.toLowerCase()];
              daysToAdd = (targetWeekdayNum - todayWeekday + 7) % 7;
              if (daysToAdd === 0 && day.toLowerCase() !== 'today') {
                daysToAdd = 7; // Next week if it's the same day
              }
            } else {
              switch (day.toLowerCase()) {
                case 'tomorrow':
                  daysToAdd = 1;
                  break;
                case 'today':
                  daysToAdd = 0;
                  break;
                default:
                  reject(new Error('Invalid day parameter'));
                  return;
              }
            }
            
            targetDate.setDate(targetDate.getDate() + daysToAdd);
            targetDateStr = targetDate.toISOString().split('T')[0];
          }
          
          // Get weekday name in Polish
          const weekdayIndex = targetDate.getDay();
          const weekdays = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
          targetWeekday = weekdays[weekdayIndex];
          
          // Filter events for the target date
          const dayEvents = allEvents.filter(event => event.date === targetDateStr);
          
          // Get lessons for the weekday
          const lessons = schedule[targetWeekday] || [];
          
          resolve({
            date: targetDateStr,
            weekday: targetWeekday,
            events: dayEvents,
            lessons: lessons,
            summary: {
              totalEvents: dayEvents.length,
              totalLessons: lessons.length,
              hasData: dayEvents.length > 0 || lessons.length > 0
            }
          });
        } catch (error) {
          reject(new Error(`Failed to parse combined data: ${error.message}`));
        }
      });
    });
  },

  /**
   * Get upcoming events within a specified number of days
   * @param {Object} options - Options object
   * @param {number} options.days - Number of days to look ahead (default: 30)
   * @param {string} options.eventType - Filter by event type ('quiz', 'test', 'meeting', 'holiday', etc.)
   * @returns {Promise} Promise resolving to upcoming events
   */
  async getUpcoming({ days = 30, eventType = null } = {}) {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, 'mobi.py');
      
      const python = spawn(process.platform === 'win32' ? 'python' : 'python3', [
        pythonScript,
        '-u', USERNAME,
        '-p', PASSWORD,
        '--calendar'
      ], {
        encoding: 'utf-8'
      });
      
      let outputData = '';
      let errorData = '';
      
      python.stdout.on('data', (data) => {
        outputData += data.toString('utf-8');
      });
      
      python.stderr.on('data', (data) => {
        errorData += data.toString('utf-8');
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          try {
            const error = JSON.parse(errorData);
            reject(new Error(error.error));
          } catch {
            reject(new Error(`Python script failed: ${errorData}`));
          }
          return;
        }
      
        try {
          const data = JSON.parse(outputData);
          const allEvents = data.events || [];
          
          // Filter for upcoming events within the specified days
          const now = new Date();
          const futureLimit = new Date();
          futureLimit.setDate(now.getDate() + days);
          
          let upcomingEvents = allEvents.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate >= now && eventDate <= futureLimit;
          });

          // Filter by event type if specified
          if (eventType) {
            upcomingEvents = upcomingEvents.filter(event => 
              event.event_type === eventType
            );
          }
          
          // Sort by date
          upcomingEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
          
          resolve({
            events: upcomingEvents,
            daysAhead: days,
            eventType: eventType,
            totalEvents: allEvents.length
          });
      
        } catch (error) {
          reject(new Error(`Failed to parse events: ${error.message}`));
        }
      });
    });
  },

  /**
   * Get all events and group them by type
   * @returns {Promise} Promise resolving to events grouped by type
   */
  async getByType() {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, 'mobi.py');
      
      const python = spawn(process.platform === 'win32' ? 'python' : 'python3', [
        pythonScript,
        '-u', USERNAME,
        '-p', PASSWORD,
        '--calendar'
      ], {
        encoding: 'utf-8'
      });
      
      let outputData = '';
      let errorData = '';
      
      python.stdout.on('data', (data) => {
        outputData += data.toString('utf-8');
      });
      
      python.stderr.on('data', (data) => {
        errorData += data.toString('utf-8');
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          try {
            const error = JSON.parse(errorData);
            reject(new Error(error.error));
          } catch {
            reject(new Error(`Python script failed: ${errorData}`));
          }
          return;
        }
      
        try {
          const data = JSON.parse(outputData);
          const allEvents = data.events || [];
          
          // Group events by type
          const eventsByType = {};
          
          allEvents.forEach(event => {
            const type = event.event_type || 'other';
            if (!eventsByType[type]) {
              eventsByType[type] = [];
            }
            eventsByType[type].push(event);
          });
          
          // Sort events within each type by date
          Object.keys(eventsByType).forEach(type => {
            eventsByType[type].sort((a, b) => new Date(a.date) - new Date(b.date));
          });
          
          resolve({
            eventsByType,
            totalEvents: allEvents.length,
            availableTypes: Object.keys(eventsByType)
          });
      
        } catch (error) {
          reject(new Error(`Failed to parse events: ${error.message}`));
        }
      });
    });
  },

  /**
   * Get events for a specific date range
   * @param {Object} options - Options object
   * @param {string} options.startDate - Start date in YYYY-MM-DD format
   * @param {string} options.endDate - End date in YYYY-MM-DD format
   * @returns {Promise} Promise resolving to events in the date range
   */
  async getDateRange({ startDate, endDate } = {}) {
    if (!startDate || !endDate) {
      return Promise.reject(new Error('Both startDate and endDate are required in YYYY-MM-DD format'));
    }

    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, 'mobi.py');
      
      const python = spawn(process.platform === 'win32' ? 'python' : 'python3', [
        pythonScript,
        '-u', USERNAME,
        '-p', PASSWORD,
        '--calendar'
      ], {
        encoding: 'utf-8'
      });
      
      let outputData = '';
      let errorData = '';
      
      python.stdout.on('data', (data) => {
        outputData += data.toString('utf-8');
      });
      
      python.stderr.on('data', (data) => {
        errorData += data.toString('utf-8');
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          try {
            const error = JSON.parse(errorData);
            reject(new Error(error.error));
          } catch {
            reject(new Error(`Python script failed: ${errorData}`));
          }
          return;
        }
      
        try {
          const data = JSON.parse(outputData);
          const allEvents = data.events || [];
          
          const start = new Date(startDate);
          const end = new Date(endDate);
          
          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            reject(new Error('Invalid date format. Use YYYY-MM-DD'));
            return;
          }
          
          // Filter events within the date range
          const rangeEvents = allEvents.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate >= start && eventDate <= end;
          });
          
          // Sort by date
          rangeEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
          
          resolve({
            events: rangeEvents,
            startDate,
            endDate,
            totalEvents: allEvents.length
          });
      
        } catch (error) {
          reject(new Error(`Failed to parse events: ${error.message}`));
        }
      });
    });
  }
};