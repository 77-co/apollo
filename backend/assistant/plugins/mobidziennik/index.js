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

      console.log('Executing mobidziennik script...');

      const pythonScript = path.join(__dirname, 'mobi.py');
      
      const python = spawn(process.platform === 'win32' ? 'python' : 'python3', [
        pythonScript,
        '-u', USERNAME,
        '-p', PASSWORD
      ], {
        encoding: 'utf-8'
      });
      
      let outputData = '';
      let errorData = '';
      
      const WEEKDAYS = [
        'poniedziałek', 
        'wtorek', 
        'środa', 
        'czwartek', 
        'piątek'
      ];
      
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
              '─Ö': 'ę', '─│': 'ą', '─Ď': 'ś', '─Ź': 'ż', 
              '─╗': 'ł', '─Ż': 'ń', '─╝': 'ó', '─Ą': 'Ę', 
              '─Ä': 'Ą', '┼Ü': 'Ś', '┼╗': 'Ż', '┼Ü': 'Ł', 
              '┼╝': 'Ń', '─│': 'ó'
            };
      
            return text.replace(/─Ö|─│|─Ď|─Ź|─╗|─Ż|─╝|─Ą|─Ä|┼Ü|┼╗|┼Ü|┼╝|─│/g, 
              match => replacements[match] || match);
          }
      
          function deepDecode(obj) {
            if (typeof obj === 'string') {
              return decodePolishChars(obj);
            }
            if (Array.isArray(obj)) {
              return obj.map(deepDecode);
            }
            if (obj !== null && typeof obj === 'object') {
              return Object.fromEntries(
                Object.entries(obj).map(([key, value]) => [key, deepDecode(value)])
              );
            }
            return obj;
          }
      
          let fullSchedule = JSON.parse(outputData);
          const decodedSchedule = deepDecode(fullSchedule);
          const targetWeekday = WEEKDAYS[weekday];
          const filteredSchedule = decodedSchedule[targetWeekday] || [];      
          resolve({
            date: targetDate.toISOString().split('T')[0],
            schedule: filteredSchedule
          });
      
        } catch (error) {
          reject(new Error(`Failed to parse schedule output: ${error.message}`));
        }
      });
      
    });
  }
};