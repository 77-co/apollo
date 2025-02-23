import argparse
import sys
import json
import locale
import codecs

from typing import Dict, List, Optional
import requests
from bs4 import BeautifulSoup
import re
from dataclasses import dataclass, asdict

sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

@dataclass
class Lesson:
    """Represents a single lesson in the schedule"""
    id: int
    time: str
    subject: str
    teacher: Optional[str] = None
    location: Optional[str] = None
    status: str = "Odbędzie się"
    weekday: Optional[str] = None

class MobiClient:
    """Client for interacting with the MobiDziennik school system"""
    
    BASE_URL = "https://zslpoznan.mobidziennik.pl/dziennik"
    WEEKDAYS = ["poniedziałek", "wtorek", "środa", "czwartek", "piątek"]
    
    TIME_TO_ID = {
        "07:20": 1, "08:10": 2, "09:05": 3, "10:00": 4,
        "11:00": 5, "11:55": 6, "13:00": 7, "14:05": 8,
        "15:00": 9, "15:55": 10, "16:45": 11, "17:35": 12,
        "18:25": 13, "19:15": 14, "20:05": 15
}
    
    def __init__(self, username: str, password: str):
        self.session = requests.Session()
        response = self.session.post(
            self.BASE_URL,
            data={"login": username, "haslo": password}
        )
        response.raise_for_status()
        
        if "Podano niepoprawny login i/lub hasło" in response.text:
            raise Exception("Invalid credentials")

    def _parse_lesson_title(self, title_text: str, left_value: str) -> Lesson:
        title_text = re.sub(r'\s+', ' ', title_text.replace('\n', '').replace('\r', '')).strip()
        
        if "odwołana" in title_text.lower():
            pattern = r'(\d{2}:\d{2} - \d{2}:\d{2})<br />(.*?)<br />'
            match = re.search(pattern, title_text)
            if match:
                return Lesson(
                    id=self._get_lesson_id(match.group(1)),
                    time=match.group(1),
                    subject=match.group(2),
                    status="Odwołana"
                )
        
        pattern = r'(\d{2}:\d{2} - \d{2}:\d{2})<br />(.*?)<br />(.*?)\((.*?)\)'
        match = re.search(pattern, title_text)
        if match:
            status = "Zastępstwo lub zmiana sali" if "zastępstwo" in title_text.lower() else "Odbędzie się"
            return Lesson(
                id=self._get_lesson_id(match.group(1)),
                time=match.group(1),
                subject=match.group(2),
                teacher=match.group(3),
                location=match.group(4),
                status=status
            )
        
        raise Exception(f"Unable to parse lesson title: {title_text}")

    def _get_lesson_id(self, time_str: str) -> int:
        return next(
            (time_id for time_value, time_id in self.TIME_TO_ID.items() 
             if time_value in time_str),
            0
        )

    def _get_weekday(self, left_value: str) -> str:
        left_percent = float(left_value.rstrip('%'))
        weekday_mapping = {0.5: 0, 20.5: 1, 40.5: 2, 60.5: 3, 80.5: 4}
        
        for threshold, day_index in weekday_mapping.items():
            if left_percent <= threshold:
                return self.WEEKDAYS[day_index]
        
        return self.WEEKDAYS[-1]

    def get_schedule(self) -> Dict[str, List[Lesson]]:
        response = self.session.get(f"{self.BASE_URL}/planlekcji?typ=podstawowy")
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        schedule_cnt = soup.find('div', class_='plansc_cnt')
        
        if not schedule_cnt:
            raise Exception("Unable to find schedule content")

        schedule: Dict[str, List[Lesson]] = {day: [] for day in self.WEEKDAYS}
        
        for div in schedule_cnt.find_all('div', class_='plansc_cnt_w'):
            first_div = div.find('div', recursive=False)
            if not first_div:
                continue
                
            style = first_div.get('style', '')
            left_value = next(
                (prop.replace('left:', '').strip() 
                 for prop in style.split(';') 
                 if prop.strip().startswith('left:')),
                None
            )
            
            if not left_value:
                continue
                
            lesson = self._parse_lesson_title(first_div['title'], left_value)
            weekday = self._get_weekday(left_value)
            lesson.weekday = weekday
            schedule[weekday].append(lesson)
        
        for day in schedule:
            schedule[day].sort(key=lambda x: x.id)
            
        return schedule

def convert_schedule_to_dict(schedule: Dict[str, List[Lesson]]) -> dict:
    """Convert schedule to a dictionary suitable for JSON serialization"""
    return {
        day: [asdict(lesson) for lesson in lessons]
        for day, lessons in schedule.items()
    }

def main():
    parser = argparse.ArgumentParser(description="Get weekly schedule from MobiDziennik")
    parser.add_argument('-u', '--user', required=True, help='Username/email')
    parser.add_argument('-p', '--password', required=True, help='Password')
    parser.add_argument('--pretty', action='store_true', help='Pretty print JSON output')
    
    args = parser.parse_args()
    
    try:
        client = MobiClient(args.user, args.password)
        schedule = client.get_schedule()
        schedule_dict = convert_schedule_to_dict(schedule)
        
        if args.pretty:
            print(json.dumps(schedule_dict, indent=2, ensure_ascii=False))
        else:
            print(json.dumps(schedule_dict, ensure_ascii=False))
            
    except Exception as e:
        error_dict = {"error": str(e)}
        print(json.dumps(error_dict), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()