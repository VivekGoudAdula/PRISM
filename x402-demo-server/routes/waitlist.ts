import { Hono } from 'hono';
import { Waitlist, WaitlistFeature, WaitlistRole } from '../models/Waitlist';

const waitlistRouter = new Hono();

const VALID_ROLES: WaitlistRole[] = [
  'Founder',
  'HR',
  'Recruiter',
  'Developer',
  'Student',
  'Product Manager',
  'Other',
];

const VALID_FEATURES: WaitlistFeature[] = [
  'Resume Screening',
  'Invoice Extraction',
  'Contract Analysis',
  'Research',
  'Customer Support',
  'Code Review',
  'Data Extraction',
  'Other',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
}

function sanitizeFeatures(features: unknown): WaitlistFeature[] {
  if (!Array.isArray(features)) return [];
  return features.filter(
    (f): f is WaitlistFeature => typeof f === 'string' && VALID_FEATURES.includes(f as WaitlistFeature)
  );
}

/**
 * GET /api/waitlist/count
 * Returns total number of waitlist signups.
 */
waitlistRouter.get('/count', async (c) => {
  try {
    const count = await Waitlist.countDocuments({});
    return c.json({ count });
  } catch (err) {
    console.error('Waitlist count error:', err);
    return c.json({ error: 'Failed to fetch waitlist count.' }, 500);
  }
});

/**
 * POST /api/waitlist
 * Join the waitlist.
 */
waitlistRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const company = typeof body?.company === 'string' ? body.company.trim() : '';
    const interestedFeatures = sanitizeFeatures(body?.interestedFeatures);

    if (!name) {
      return c.json({ error: 'Name is required.' }, 400);
    }
    if (!isValidEmail(body?.email)) {
      return c.json({ error: 'A valid email address is required.' }, 400);
    }
    if (!company) {
      return c.json({ error: 'Company is required.' }, 400);
    }
    if (!body?.role || !VALID_ROLES.includes(body.role)) {
      return c.json({ error: 'Please select a valid role.' }, 400);
    }
    if (interestedFeatures.length === 0) {
      return c.json({ error: 'Please select at least one AI task to automate.' }, 400);
    }

    const email = body.email.trim().toLowerCase();

    const existing = await Waitlist.findOne({ email });
    if (existing) {
      const position = await Waitlist.countDocuments({
        createdAt: { $lte: existing.createdAt },
        status: 'waiting',
      });
      return c.json(
        {
          error: 'This email is already on the waitlist.',
          alreadyRegistered: true,
          position,
        },
        409
      );
    }

    const entry = await Waitlist.create({
      name,
      email,
      company,
      role: body.role,
      interestedFeatures,
      source: typeof body.source === 'string' ? body.source : 'landing_page',
      status: 'waiting',
    });

    const position = await Waitlist.countDocuments({
      createdAt: { $lte: entry.createdAt },
      status: 'waiting',
    });

    return c.json(
      {
        success: true,
        message: "You're on the waitlist!",
        position,
        entry: {
          email: entry.email,
          name: entry.name,
          createdAt: entry.createdAt,
        },
      },
      201
    );
  } catch (err: any) {
    if (err?.code === 11000) {
      return c.json({ error: 'This email is already on the waitlist.' }, 409);
    }
    console.error('Waitlist signup error:', err);
    return c.json({ error: 'Failed to join the waitlist. Please try again.' }, 500);
  }
});

export default waitlistRouter;
