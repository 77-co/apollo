import argparse
import sys
import json
import locale
import codecs
import re

from typing import Dict, List, Optional, Union
import requests
from bs4 import BeautifulSoup
from dataclasses import dataclass, asdict

# Set UTF-8 encoding explicitly
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

@dataclass
class CalendarEvent:
    """Represents an event in the calendar"""
    date: str  # YYYY-MM-DD format
    title: str
    description: Optional[str] = None
    event_id: Optional[str] = None
    color: Optional[str] = None
    event_type: Optional[str] = None

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
        # Set proper headers for UTF-8
        self.session.headers.update({
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Charset': 'UTF-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        response = self.session.post(
            self.BASE_URL,
            data={"login": username, "haslo": password}
        )
        response.raise_for_status()
        
        if "Podano niepoprawny login i/lub hasło" in response.text:
            raise Exception("Invalid credentials")

    def _decode_unicode_escapes(self, text: str) -> str:
        """Decode Unicode escape sequences like \\u0144 to proper UTF-8"""
        if not text:
            return text
        
        try:
            # Handle both \u and \\u patterns
            text = text.replace('\\u', '\\u')
            # Decode Unicode escapes
            return text.encode().decode('unicode_escape')
        except (UnicodeDecodeError, UnicodeEncodeError):
            try:
                # Alternative approach using codecs
                return codecs.decode(text, 'unicode_escape')
            except:
                # If all else fails, return original text
                return text

    def _clean_html_text(self, text: str) -> str:
        """Clean HTML tags and normalize whitespace"""
        if not text:
            return ""
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text.replace('\n', '').replace('\r', '')).strip()
        # Decode Unicode escapes
        text = self._decode_unicode_escapes(text)
        return text

    def _parse_lesson_title(self, title_text: str, left_value: str) -> Lesson:
        # Clean the HTML and normalize text
        cleaned_text = self._clean_html_text(title_text)
        
        if not cleaned_text:
            raise Exception("Empty lesson title")
        
        # Check if lesson is cancelled
        if "odwołana" in cleaned_text.lower():
            time_pattern = r'(\d{2}:\d{2} - \d{2}:\d{2})'
            time_match = re.search(time_pattern, cleaned_text)
            if time_match:
                time_str = time_match.group(1)
                # Extract subject (everything after time until end or next identifiable part)
                subject_text = re.sub(time_pattern, '', cleaned_text).strip()
                return Lesson(
                    id=self._get_lesson_id(time_str),
                    time=time_str,
                    subject=subject_text,
                    status="Odwołana"
                )
        
        # Check for substitution
        is_substitution = "zastępstwo" in cleaned_text.lower()
        
        # Extract time
        time_pattern = r'(\d{2}:\d{2} - \d{2}:\d{2})'
        time_match = re.search(time_pattern, cleaned_text)
        
        if not time_match:
            raise Exception(f"Unable to find time in lesson title: {cleaned_text}")
        
        time_str = time_match.group(1)
        
        # Remove time from text to parse the rest
        remaining_text = re.sub(time_pattern, '', cleaned_text).strip()
        
        # Split by common separators and clean up
        parts = [part.strip() for part in re.split(r'[-–—]', remaining_text) if part.strip()]
        
        if len(parts) >= 2:
            # First part is usually subject, last part is usually teacher
            subject = parts[0]
            teacher = parts[-1]
            
            # Try to extract location if it exists (usually in parentheses or after specific patterns)
            location_match = re.search(r'\(([^)]+)\)', remaining_text)
            location = location_match.group(1) if location_match else None
            
            status = "Zastępstwo" if is_substitution else "Odbędzie się"
            
            return Lesson(
                id=self._get_lesson_id(time_str),
                time=time_str,
                subject=subject,
                teacher=teacher,
                location=location,
                status=status
            )
        elif len(parts) == 1:
            # Only one part - treat as subject
            return Lesson(
                id=self._get_lesson_id(time_str),
                time=time_str,
                subject=parts[0],
                status="Zastępstwo" if is_substitution else "Odbędzie się"
            )
        else:
            # Fallback: use the entire remaining text as subject
            return Lesson(
                id=self._get_lesson_id(time_str),
                time=time_str,
                subject=remaining_text,
                status="Zastępstwo" if is_substitution else "Odbędzie się"
            )

    def _get_lesson_id(self, time_str: str) -> int:
        # Extract start time from "HH:MM - HH:MM" format
        start_time = time_str.split(' - ')[0] if ' - ' in time_str else time_str
        return self.TIME_TO_ID.get(start_time, 0)

    def _get_weekday(self, left_value: str) -> str:
        left_percent = float(left_value.rstrip('%'))
        weekday_mapping = {0.5: 0, 20.5: 1, 40.5: 2, 60.5: 3, 80.5: 4}
        
        for threshold, day_index in weekday_mapping.items():
            if left_percent <= threshold:
                return self.WEEKDAYS[day_index]
        
        return self.WEEKDAYS[-1]

    def _extract_calendar_events(self, html_content: str) -> List[CalendarEvent]:
        """Extract events from FullCalendar JavaScript initialization"""
        events = []
        
        # Look for the events array in the FullCalendar initialization
        # Pattern: events: [{...}, {...}, ...]
        pattern = r'events:\s*\[(.*?)\](?=\s*[,}])'
        match = re.search(pattern, html_content, re.DOTALL)
        
        if not match:
            return events
        
        events_text = '[' + match.group(1) + ']'
        
        try:
            # Parse the JavaScript array as JSON
            # Handle JavaScript object format
            events_text = re.sub(r'(\w+):', r'"\1":', events_text)  # Quote unquoted property names
            events_text = re.sub(r"'([^']*)'", r'"\1"', events_text)  # Convert single quotes to double
            
            # Parse as JSON
            events_data = json.loads(events_text)
            
            for event_data in events_data:
                if isinstance(event_data, dict):
                    # Decode Unicode escapes in title and comment
                    title = self._decode_unicode_escapes(event_data.get('title', ''))
                    comment = self._decode_unicode_escapes(event_data.get('comment', ''))
                    
                    event = CalendarEvent(
                        date=event_data.get('start', ''),
                        title=title,
                        description=comment if comment and comment != title else None,
                        event_id=event_data.get('id', ''),
                        color=event_data.get('color', ''),
                        event_type=self._determine_event_type_from_title(title)
                    )
                    events.append(event)
                    
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Warning: Failed to parse calendar events with JSON: {e}", file=sys.stderr)
            # Fallback: try to extract events manually with regex
            events = self._extract_events_manual(html_content)
        
        return events

    def _extract_events_manual(self, html_content: str) -> List[CalendarEvent]:
        """Manually extract events using regex when JSON parsing fails"""
        events = []
        
        # Look for individual event objects in the JavaScript
        # This regex handles the actual format with escaped quotes
        event_pattern = r'\{\s*"title":\s*"([^"]*)",\s*"start":\s*"([^"]*)"[^}]*?"comment":\s*"([^"]*)"[^}]*?\}'
        matches = re.findall(event_pattern, html_content, re.DOTALL)
        
        for title, start_date, comment in matches:
            # Decode Unicode escapes
            title = self._decode_unicode_escapes(title)
            comment = self._decode_unicode_escapes(comment)
            
            event = CalendarEvent(
                date=start_date,
                title=title,
                description=comment if comment != title else None,
                event_type=self._determine_event_type_from_title(title)
            )
            events.append(event)
        
        return events

    def _determine_event_type_from_title(self, title: str) -> str:
        """Determine event type based on title content"""
        title_lower = title.lower()
        
        if any(word in title_lower for word in ['kartkówka', 'kartkowka']):
            return 'quiz'
        elif any(word in title_lower for word in ['sprawdzian', 'test']):
            return 'test'
        elif any(word in title_lower for word in ['spotkanie', 'rodzic']):
            return 'meeting'
        elif any(word in title_lower for word in ['uroczysty', 'strój', 'ceremonia']):
            return 'ceremony'
        elif any(word in title_lower for word in ['dyktando']):
            return 'dictation'
        elif any(word in title_lower for word in ['dzień wolny', 'wolny', 'święto']):
            return 'holiday'
        elif any(word in title_lower for word in ['zakończenie', 'koniec']):
            return 'end_of_term'
        elif any(word in title_lower for word in ['ocen', 'wystawienie']):
            return 'grades'
        else:
            return 'other'

    def get_schedule(self) -> Dict[str, List[Lesson]]:
        """Get the weekly schedule from planlekcji"""
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
            
            try:
                lesson = self._parse_lesson_title(first_div.get('title', ''), left_value)
                weekday = self._get_weekday(left_value)
                lesson.weekday = weekday
                schedule[weekday].append(lesson)
            except Exception as e:
                # Log the error but continue processing other lessons
                print(f"Warning: Failed to parse lesson: {e}", file=sys.stderr)
                continue
        
        for day in schedule:
            schedule[day].sort(key=lambda x: x.id)
            
        return schedule

    def get_calendar_events(self) -> List[CalendarEvent]:
        """Get calendar events from kalendarzklasowy"""
        response = self.session.get(f"{self.BASE_URL}/kalendarzklasowy")
        response.raise_for_status()
        
        events = self._extract_calendar_events(response.text)
        return sorted(events, key=lambda x: x.date)

def convert_schedule_to_dict(schedule: Dict[str, List[Lesson]]) -> dict:
    """Convert schedule to a dictionary suitable for JSON serialization"""
    return {
        day: [asdict(lesson) for lesson in lessons]
        for day, lessons in schedule.items()
    }

def convert_events_to_dict(events: List[CalendarEvent]) -> list:
    """Convert events to a list suitable for JSON serialization"""
    return [asdict(event) for event in events]

def main():
    parser = argparse.ArgumentParser(description="Get schedule and calendar from MobiDziennik")
    parser.add_argument('-u', '--user', required=True, help='Username/email')
    parser.add_argument('-p', '--password', required=True, help='Password')
    parser.add_argument('--schedule', action='store_true', help='Get weekly schedule')
    parser.add_argument('--calendar', action='store_true', help='Get calendar events')
    parser.add_argument('--pretty', action='store_true', help='Pretty print JSON output')
    
    args = parser.parse_args()
    
    # Default to schedule if neither specified
    if not args.schedule and not args.calendar:
        args.schedule = True
    
    try:
        client = MobiClient(args.user, args.password)
        result = {}
        
        if args.schedule:
            schedule = client.get_schedule()
            result['schedule'] = convert_schedule_to_dict(schedule)
        
        if args.calendar:
            events = client.get_calendar_events()
            result['events'] = convert_events_to_dict(events)
        
        # Use ensure_ascii=False to properly output UTF-8 characters
        if args.pretty:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(json.dumps(result, ensure_ascii=False))
            
    except Exception as e:
        error_dict = {"error": str(e)}
        print(json.dumps(error_dict, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()