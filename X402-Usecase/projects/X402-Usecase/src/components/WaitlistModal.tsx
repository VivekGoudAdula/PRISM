import React, { useState } from 'react';
import { useSnackbar } from 'notistack';
import { FiX, FiLoader } from 'react-icons/fi';
import {
  joinWaitlist,
  isValidEmail,
  WAITLIST_ROLES,
  WAITLIST_FEATURES,
  WaitlistFeature,
  WaitlistRole,
} from '../utils/waitlistApi';

interface WaitlistModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (position: number) => void;
}

type FormErrors = {
  name?: string;
  email?: string;
  company?: string;
  role?: string;
  interestedFeatures?: string;
};

const WaitlistModal: React.FC<WaitlistModalProps> = ({ open, onClose, onSuccess }) => {
  const { enqueueSnackbar } = useSnackbar();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState<WaitlistRole | ''>('');
  const [interestedFeatures, setInterestedFeatures] = useState<WaitlistFeature[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successPosition, setSuccessPosition] = useState<number | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const resetForm = () => {
    setName('');
    setEmail('');
    setCompany('');
    setRole('');
    setInterestedFeatures([]);
    setErrors({});
    setSuccessPosition(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const toggleFeature = (feature: WaitlistFeature) => {
    setInterestedFeatures((prev) => {
      const next = prev.includes(feature)
        ? prev.filter((f) => f !== feature)
        : [...prev, feature];
      if (next.length > 0) {
        setErrors((e) => ({ ...e, interestedFeatures: undefined }));
      }
      return next;
    });
  };

  const validate = (): boolean => {
    const next: FormErrors = {};

    if (!name.trim()) next.name = 'Name is required.';
    if (!email.trim()) {
      next.email = 'Email is required.';
    } else if (!isValidEmail(email)) {
      next.email = 'Please enter a valid email address.';
    }
    if (!company.trim()) next.company = 'Company is required.';
    if (!role) next.role = 'Please select your role.';
    if (interestedFeatures.length === 0) {
      next.interestedFeatures = 'Please select at least one AI task.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const result = await joinWaitlist({
        name: name.trim(),
        email: email.trim(),
        company: company.trim(),
        role: role as WaitlistRole,
        interestedFeatures,
      });
      setSuccessPosition(result.position);
      onSuccess?.(result.position);
      enqueueSnackbar("You're on the waitlist!", { variant: 'success' });
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        'Failed to join the waitlist. Please try again.';
      if (err.response?.data?.alreadyRegistered && err.response?.data?.position) {
        setSuccessPosition(err.response.data.position);
        enqueueSnackbar('This email is already on the waitlist.', { variant: 'info' });
      } else {
        enqueueSnackbar(msg, { variant: 'error' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="waitlist-modal-title"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto liquid-glass p-6 md:p-8 animate-scale-up border border-white/10"
      >
        <button
          type="button"
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-lg transition-colors"
          onClick={handleClose}
          disabled={submitting}
          aria-label="Close"
        >
          <FiX className="text-xl" />
        </button>

        {successPosition !== null ? (
          <div className="text-center py-6 px-2">
            <div className="text-5xl mb-4">🎉</div>
            <h2 id="waitlist-modal-title" className="text-2xl font-extrabold text-white mb-3">
              You're on the Waitlist!
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              We'll invite you as soon as Prism launches on Algorand MainNet.
            </p>
            <div className="inline-flex flex-col items-center gap-1 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl px-8 py-5">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
                Your Position
              </span>
              <span className="text-4xl font-black text-white">#{successPosition}</span>
            </div>
            <button
              type="button"
              className="btn btn-primary w-full mt-8 rounded-xl font-bold"
              onClick={handleClose}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 id="waitlist-modal-title" className="text-xl font-extrabold text-white mb-1 pr-8">
              Join the Waitlist
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              Be first to access decentralized AI routing on Algorand MainNet.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Your name"
                  className={`input input-bordered bg-slate-950/60 border-slate-800 text-sm focus:border-indigo-500 focus:outline-none w-full ${errors.name ? 'border-rose-500/60' : ''}`}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (e.target.value.trim()) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  disabled={submitting}
                  required
                />
                {errors.name && <p className="text-rose-400 text-xs">{errors.name}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Email <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  className={`input input-bordered bg-slate-950/60 border-slate-800 text-sm focus:border-indigo-500 focus:outline-none w-full ${errors.email ? 'border-rose-500/60' : ''}`}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (e.target.value.trim()) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  disabled={submitting}
                  required
                />
                {errors.email && <p className="text-rose-400 text-xs">{errors.email}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Company <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Company name"
                  className={`input input-bordered bg-slate-950/60 border-slate-800 text-sm focus:border-indigo-500 focus:outline-none w-full ${errors.company ? 'border-rose-500/60' : ''}`}
                  value={company}
                  onChange={(e) => {
                    setCompany(e.target.value);
                    if (e.target.value.trim()) setErrors((prev) => ({ ...prev, company: undefined }));
                  }}
                  disabled={submitting}
                  required
                />
                {errors.company && <p className="text-rose-400 text-xs">{errors.company}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Role <span className="text-rose-400">*</span>
                </label>
                <select
                  className={`select select-bordered bg-slate-950/60 border-slate-800 text-sm focus:border-indigo-500 focus:outline-none w-full text-slate-200 ${errors.role ? 'border-rose-500/60' : ''}`}
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value as WaitlistRole | '');
                    if (e.target.value) setErrors((prev) => ({ ...prev, role: undefined }));
                  }}
                  disabled={submitting}
                  required
                >
                  <option value="">Select your role</option>
                  {WAITLIST_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {errors.role && <p className="text-rose-400 text-xs">{errors.role}</p>}
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="text-xs font-bold text-slate-300 mb-1">
                  Which AI tasks would you like Prism to automate first?{' '}
                  <span className="text-rose-400">*</span>
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {WAITLIST_FEATURES.map((feature) => {
                    const selected = interestedFeatures.includes(feature);
                    return (
                      <label
                        key={feature}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all text-sm ${
                          selected
                            ? 'border-indigo-500/50 bg-indigo-950/30 text-white'
                            : 'border-slate-800/80 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                        } ${submitting ? 'opacity-60 pointer-events-none' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary"
                          checked={selected}
                          onChange={() => toggleFeature(feature)}
                          disabled={submitting}
                        />
                        <span className="font-medium">{feature}</span>
                      </label>
                    );
                  })}
                </div>
                {errors.interestedFeatures && (
                  <p className="text-rose-400 text-xs">{errors.interestedFeatures}</p>
                )}
              </fieldset>

              <button
                type="submit"
                className="btn btn-primary w-full rounded-xl font-bold text-sm mt-2 shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <FiLoader className="animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Join Waitlist'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default WaitlistModal;
