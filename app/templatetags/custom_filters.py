# from django import template
# from django.utils import timezone
# from datetime import datetime
# import pytz

# register = template.Library()

# @register.filter(name='timeago')
# def timeago(value, default="never"):
#     """
#     Returns a human-friendly time difference from now (e.g., "4 hours ago").
#     If value is None or empty, it returns the default text.
#     """
#     if value is None or value == '':
#         return default
    
#     # Convert string to datetime if needed
#     if isinstance(value, str):
#         try:
#             # Try to parse ISO format
#             value = datetime.fromisoformat(value.replace('Z', '+00:00'))
#         except (ValueError, TypeError):
#             return default
    
#     # Ensure value is timezone aware
#     if timezone.is_naive(value):
#         value = timezone.make_aware(value, pytz.UTC)
    
#     now = timezone.now()
#     diff = now - value
    
#     seconds = diff.total_seconds()
    
#     # Format the time difference
#     if seconds < 60:
#         return f"{int(seconds)} seconds ago"
#     elif seconds < 3600:
#         minutes = int(seconds // 60)
#         return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
#     elif seconds < 86400:
#         hours = int(seconds // 3600)
#         return f"{hours} hour{'s' if hours != 1 else ''} ago"
#     elif seconds < 604800:
#         days = int(seconds // 86400)
#         return f"{days} day{'s' if days != 1 else ''} ago"
#     elif seconds < 2592000:
#         weeks = int(seconds // 604800)
#         return f"{weeks} week{'s' if weeks != 1 else ''} ago"
#     else:
#         months = int(seconds // 2592000)
#         return f"{months} month{'s' if months != 1 else ''} ago"
