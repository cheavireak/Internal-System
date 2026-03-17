import express from 'express';
import { db } from '../db.js';

const router = express.Router();

router.get('/', (req, res) => {
  const query = req.query.q as string;
  
  if (!query || query.length < 2) {
    return res.json([]);
  }

  const searchTerm = `%${query}%`;
  const results: any[] = [];

  try {
    // Search Users
    const users = db.prepare(`
      SELECT id, name, email, role 
      FROM users 
      WHERE (name LIKE ? OR email LIKE ?) AND deleted_at IS NULL
      LIMIT 5
    `).all(searchTerm, searchTerm) as any[];

    users.forEach(user => {
      results.push({
        type: 'user',
        id: user.id,
        title: user.name,
        subtitle: user.email,
        icon: 'User',
        link: '/admin' // Users are managed in admin panel
      });
    });

    // Search Customers
    const customers = db.prepare(`
      SELECT id, customer_name, pipeline_stage, status 
      FROM customers 
      WHERE (customer_name LIKE ? OR content LIKE ? OR tags LIKE ?) AND deleted_at IS NULL
      LIMIT 5
    `).all(searchTerm, searchTerm, searchTerm) as any[];

    const stageToRoute: Record<string, string> = {
      'NewIntegration': '/new-integration',
      'SandboxToProduction': '/sandbox-to-production',
      'Delay': '/delay-project',
      'Lost': '/lost-leads',
      'Expired': '/expired',
      'SMPP': '/smpp'
    };

    customers.forEach(customer => {
      const route = stageToRoute[customer.pipeline_stage] || '/';
      results.push({
        type: 'customer',
        id: customer.id,
        title: customer.customer_name,
        subtitle: `${customer.pipeline_stage} • ${customer.status || 'No Status'}`,
        icon: 'Briefcase',
        link: `${route}?highlight=${customer.id}`
      });
    });

    // Search Audit Logs (for admin context mostly, but useful)
    const logs = db.prepare(`
      SELECT id, action, entity, details, timestamp 
      FROM audit_logs 
      WHERE details LIKE ? OR action LIKE ?
      ORDER BY timestamp DESC
      LIMIT 3
    `).all(searchTerm, searchTerm) as any[];

    logs.forEach(log => {
      results.push({
        type: 'log',
        id: log.id,
        title: `${log.action} ${log.entity}`,
        subtitle: log.details,
        icon: 'FileText',
        link: '/audit-logs'
      });
    });

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
