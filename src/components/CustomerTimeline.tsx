import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  PlusCircle, Edit2, Trash2, ArrowRightCircle, RefreshCw, Activity, 
  CheckCircle, AlertCircle, Clock, FileText 
} from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  details: string;
  user: string;
  timestamp: string;
  icon: string;
}

const iconMap: Record<string, any> = {
  PlusCircle, Edit2, Trash2, ArrowRightCircle, RefreshCw, Activity,
  CheckCircle, AlertCircle, Clock, FileText
};

export default function CustomerTimeline({ customerId }: { customerId: number }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const res = await fetch(`/api/customers/timeline/${customerId}`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data);
        }
      } catch (error) {
        console.error('Failed to fetch timeline:', error);
      } finally {
        setLoading(false);
      }
    };

    if (customerId) {
      fetchTimeline();
    }
  }, [customerId]);

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading timeline...</div>;
  }

  if (events.length === 0) {
    return <div className="p-4 text-center text-gray-500">No history available.</div>;
  }

  // Filter out duplicates (same timestamp and same title)
  const uniqueEvents = events.filter((event, index, self) =>
    index === self.findIndex((e) => (
      e.timestamp === event.timestamp && e.title === event.title
    ))
  );

  return (
    <div className="flow-root">
      <ul role="list" className="-mb-8">
        {uniqueEvents.map((event, eventIdx) => {
          const IconComponent = iconMap[event.icon] || Activity;
          
          return (
            <li key={event.id}>
              <div className="relative pb-8">
                {eventIdx !== uniqueEvents.length - 1 ? (
                  <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
                ) : null}
                <div className="relative flex space-x-3">
                  <div>
                    <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-gray-900 ${
                      event.type === 'create' ? 'bg-green-500' :
                      event.type === 'delete' ? 'bg-red-500' :
                      event.type === 'move' ? 'bg-blue-500' :
                      'bg-gray-500'
                    }`}>
                      <IconComponent className="h-5 w-5 text-white" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-gray-900 dark:text-white mr-1">{event.title}</span>
                        by <span className="font-medium text-gray-900 dark:text-white">{event.user}</span>
                      </p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{event.details}</p>
                    </div>
                    <div className="whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                      <time dateTime={event.timestamp}>{format(new Date(event.timestamp), 'MMM d, yyyy h:mm a')}</time>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
