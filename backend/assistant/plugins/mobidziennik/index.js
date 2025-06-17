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

const WEEKDAYS = [
  "poniedziałek",
  "wtorek", 
  "środa",
  "czwartek",
  "piątek"
];

export default {
  async execute({ day = 'tomorrow' } = {}) {
    return new Promise((resolve, reject) => {
      let targetDate = new Date();
      let daysToAdd = 0;

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
          reject(new Error('Invalid day parameter. Use "today", "tomorrow", or "dayaftertomorrow"'));
          return;
      }

      targetDate.setDate(targetDate.getDate() + daysToAdd);
      const weekday = targetDate.getDay() - 1; 

      if (weekday < 0 || weekday > 4) {
        resolve({
          date: targetDate.toISOString().split('T')[0],
          message: "No classes on weekends",
          schedule: []
        });
        return;
      }

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
          function decodePolishChars(text) {
            const replacements = {
              // Common UTF-8 encoding issues for Polish characters
              '─Ö': 'ę', '─ę': 'ę', 'Ä™': 'ę',
              '─ä': 'ą', '─│': 'ą', 'Ä…': 'ą',
              '─Ť': 'ś', '─Ď': 'ś', 'Ĺ›': 'ś',
              '┼Ť': 'ś', '┼ť': 'ś',
              '─╝': 'ż', '─Ź': 'ż', 'ĹĽ': 'ż',
              '┼╗': 'Ż', '┼ž': 'ż',
              '─ç': 'ł', '─╗': 'ł', 'Ĺ‚': 'ł',
              '┼Ł': 'Ł', '┼ł': 'ł',
              '─Ĺ': 'ń', '─Ż': 'ń', 'Ĺ„': 'ń',
              '┼ą': 'Ń', '┼ä': 'ń',
              '├│': 'ó', '─Â': 'ó', 'Ă³': 'ó',
              '┼Ü': 'Ó', '┼ü': 'ó',
              '─ć': 'ć', '─ç': 'ć', 'Ä‡': 'ć',
              '─Ż': 'Ć', '─ć': 'ć',
              // Uppercase versions
              '─Ş': 'Ę', '─ą': 'Ą', '┼Ü': 'Ś',
              '┼╗': 'Ż', '┼Ł': 'Ł', '┼ä': 'Ń',
              // Additional mappings based on your output
              '┼é': 'ł', '┼Ť': 'ś', '─ů': 'ą'
            };

            let result = text;
            for (const [encoded, decoded] of Object.entries(replacements)) {
              result = result.replace(new RegExp(encoded, 'g'), decoded);
            }
            return result;
          }

          function deepDecode(obj) {
            if (typeof obj === 'string') {
              return decodePolishChars(obj);
            }
            if (Array.isArray(obj)) {
              return obj.map(deepDecode);
            }
            if (obj !== null && typeof obj === 'object') {
              const result = {};
              for (const [key, value] of Object.entries(obj)) {
                const decodedKey = decodePolishChars(key);
                result[decodedKey] = deepDecode(value);
              }
              return result;
            }
            return obj;
          }

          let fullSchedule = JSON.parse(outputData);
          const decodedResponse = deepDecode(fullSchedule);
          
          // Extract the actual schedule from the nested structure
          const scheduleData = decodedResponse.schedule || decodedResponse;
          const targetWeekday = WEEKDAYS[weekday];
          
          // Debug output
          console.log('=== DEBUGGING INFO ===');
          console.log('Target weekday:', JSON.stringify(targetWeekday));
          console.log('Full response structure:', Object.keys(decodedResponse));
          console.log('Schedule data keys:', Object.keys(scheduleData));
          console.log('Available weekdays in schedule:', Object.keys(scheduleData).map(k => JSON.stringify(k)));
          
          // Try to find matching key
          let filteredSchedule = [];
          let usedKey = null;
          
          // First try exact match
          if (scheduleData[targetWeekday]) {
            filteredSchedule = scheduleData[targetWeekday];
            usedKey = targetWeekday;
            console.log('Found exact match for:', targetWeekday);
          } else {
            // Try to find a key that matches when normalized
            const normalizeString = (str) => str.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const normalizedTarget = normalizeString(targetWeekday);
            
            console.log('Normalized target:', normalizedTarget);
            
            for (const [key, value] of Object.entries(scheduleData)) {
              const normalizedKey = normalizeString(key);
              console.log(`Comparing "${normalizedKey}" with "${normalizedTarget}"`);
              
              if (normalizedKey === normalizedTarget || 
                  normalizedKey.includes(normalizedTarget) || 
                  normalizedTarget.includes(normalizedKey)) {
                filteredSchedule = value;
                usedKey = key;
                console.log(`Found match with key: "${key}"`);
                break;
              }
            }
          }
          
          console.log(`Final used key: "${usedKey}"`);
          console.log(`Schedule length for ${targetWeekday}:`, filteredSchedule ? filteredSchedule.length : 0);
          console.log('=== END DEBUGGING ===');
          
          resolve({
            date: targetDate.toISOString().split('T')[0],
            schedule: filteredSchedule,
            weekday: targetWeekday,
            usedKey: usedKey,
            fullSchedule: scheduleData
          });

        } catch (error) {
          console.error('Parse error:', error);
          console.error('Raw output:', outputData);
          reject(new Error(`Failed to parse schedule output: ${error.message}`));
        }
      });
      
    });
  }
};