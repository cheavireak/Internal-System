import express from 'express';
import { db } from '../db.js';

const router = express.Router();

router.get('/:id', (req, res) => {
  const customerId = req.params.id;

  try {
    // Get customer creation info
    const customer = db.prepare('SELECT create_date, customer_name FROM customers WHERE id = ?').get(customerId) as any;
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const events: any[] = [];

    // Add creation event
    if (customer.create_date) {
      events.push({
        id: `create-${customerId}`,
        type: 'create',
        title: 'Customer Created',
        details: `Customer ${customer.customer_name} was added to the pipeline`,
        user: 'System', // Or fetch creator if available
        timestamp: customer.create_date,
        icon: 'Plus'
      });
    }

    // Get audit logs
    const logs = db.prepare(`
      SELECT id, action, details, userName, timestamp 
      FROM audit_logs 
      WHERE entity = 'customer' AND entityId = ?
      ORDER BY timestamp DESC
    `).all(customerId) as any[];

    logs.forEach(log => {
      events.push({
        id: log.id,
        type: log.action,
        title: formatActionTitle(log.action),
        details: log.details,
        user: log.userName || 'Unknown User',
        timestamp: log.timestamp,
        icon: getActionIcon(log.action)
      });
    });

    // Sort by timestamp descending (newest first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json(events);
  } catch (error) {
    console.error('Timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

function formatActionTitle(action: string) {
  switch (action) {
    case 'create': return 'Created';
    case 'update': return 'Updated';
    case 'delete': return 'Deleted';
    case 'move': return 'Moved Stage';
    case 'integration': return 'New Integration';
    case 'restore': return 'Restored';
    default: return action.charAt(0).toUpperCase() + action.slice(1);
  }
}

function getActionIcon(action: string) {
  switch (action) {
    case 'create': return 'PlusCircle';
    case 'update': return 'Edit2';
    case 'delete': return 'Trash2';
    case 'move': return 'ArrowRightCircle';
    case 'integration': return 'FileText';
    case 'restore': return 'RefreshCw';
    default: return 'Activity';
  }
}

export default router;
