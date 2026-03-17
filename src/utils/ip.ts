import { Request } from 'express';

export function getClientIp(req: Request): string {
  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '';
  let clientIp = Array.isArray(rawIp) ? rawIp[0] : (typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '');
  
  if (!clientIp) return 'Unknown';
  
  // Convert IPv4-mapped IPv6 addresses to standard IPv4 format
  if (clientIp.startsWith('::ffff:')) {
    clientIp = clientIp.substring(7);
  }
  
  // Localhost
  if (clientIp === '::1') {
    clientIp = '127.0.0.1';
  }
  
  return clientIp;
}
